import { db } from './database';
import {
  gymRoutines,
  gymExercises,
  gymSessions,
  gymSets,
} from '../../drizzle/schema';
import { eq, desc, and, inArray, gte, lte } from 'drizzle-orm';
import { generateUUID } from '../utils/uuid';
import type {
  GymRoutine,
  GymExercise,
  GymSession,
  GymSet,
  NewGymRoutine,
  NewGymExercise,
  NewGymSession,
  NewGymSet,
} from '../../drizzle/schema';

export type ExerciseWithSets = GymExercise & { lastSets: GymSet[] };
export type SessionWithSets = GymSession & { sets: GymSet[] };

export type OverloadAlert = {
  exerciseId: string;
  exerciseName: string;
  currentWeightKg: number;
  nextWeightKg: number;
};

export type Zones = {
  z1: number;
  z2: number;
  z3: number;
  z4: number;
  z5: number;
};

export type SessionWithExercises = GymSession & {
  routineName: string;
  exercises: Array<{
    exercise: GymExercise;
    sets: GymSet[];
  }>;
};

export const gymService = {
  // ── Routines ──────────────────────────────────────────────────────────────

  async getRoutines(): Promise<GymRoutine[]> {
    return db.select().from(gymRoutines).orderBy(gymRoutines.createdAt);
  },

  async getOrCreateRoutine(name: string): Promise<GymRoutine> {
    const existing = await db
      .select()
      .from(gymRoutines)
      .where(eq(gymRoutines.name, name))
      .limit(1);
    if (existing[0]) return existing[0];

    const routine: NewGymRoutine = {
      id: generateUUID(),
      name,
      emoji: '💪',
      days: '[]',
      isActive: true,
      createdAt: new Date(),
    };
    await db.insert(gymRoutines).values(routine);
    return routine as GymRoutine;
  },

  async createRoutine(name: string, emoji: string, days: number[]): Promise<GymRoutine> {
    const routine: NewGymRoutine = {
      id: generateUUID(),
      name,
      emoji,
      days: JSON.stringify(days),
      isActive: true,
      createdAt: new Date(),
    };
    await db.insert(gymRoutines).values(routine);
    return routine as GymRoutine;
  },

  async updateRoutine(id: string, name: string): Promise<void> {
    await db.update(gymRoutines).set({ name }).where(eq(gymRoutines.id, id));
  },

  async deleteRoutine(id: string): Promise<void> {
    await db.delete(gymRoutines).where(eq(gymRoutines.id, id));
  },

  // ── Exercises ─────────────────────────────────────────────────────────────

  async getExercisesForRoutine(routineId: string): Promise<GymExercise[]> {
    return db
      .select()
      .from(gymExercises)
      .where(eq(gymExercises.routineId, routineId))
      .orderBy(gymExercises.orderIndex);
  },

  async getOrCreateExercise(routineId: string, name: string): Promise<GymExercise> {
    const existing = await db
      .select()
      .from(gymExercises)
      .where(and(eq(gymExercises.routineId, routineId), eq(gymExercises.name, name)))
      .limit(1);
    if (existing[0]) return existing[0];

    const all = await db.select().from(gymExercises).where(eq(gymExercises.routineId, routineId));
    const exercise: NewGymExercise = {
      id: generateUUID(),
      routineId,
      name,
      targetSets: 3,
      targetRepsMin: 8,
      targetRepsMax: 12,
      currentWeightKg: 0,
      incrementKg: 2.5,
      orderIndex: all.length,
      createdAt: new Date(),
    };
    await db.insert(gymExercises).values(exercise);
    return exercise as GymExercise;
  },

  async createExercise(input: {
    routineId: string;
    name: string;
    targetSets?: number;
    targetRepsMin?: number;
    targetRepsMax?: number;
    currentWeightKg?: number;
    incrementKg?: number;
  }): Promise<GymExercise> {
    const existing = await db
      .select()
      .from(gymExercises)
      .where(eq(gymExercises.routineId, input.routineId));

    const exercise: NewGymExercise = {
      id: generateUUID(),
      routineId: input.routineId,
      name: input.name,
      targetSets: input.targetSets ?? 3,
      targetRepsMin: input.targetRepsMin ?? 8,
      targetRepsMax: input.targetRepsMax ?? 12,
      currentWeightKg: input.currentWeightKg ?? 0,
      incrementKg: input.incrementKg ?? 2.5,
      orderIndex: existing.length,
      createdAt: new Date(),
    };
    await db.insert(gymExercises).values(exercise);
    return exercise as GymExercise;
  },

  async updateExerciseWeight(id: string, newWeightKg: number): Promise<void> {
    await db.update(gymExercises).set({ currentWeightKg: newWeightKg }).where(eq(gymExercises.id, id));
  },

  async deleteExercise(id: string): Promise<void> {
    await db.delete(gymExercises).where(eq(gymExercises.id, id));
  },

  // ── Sessions ──────────────────────────────────────────────────────────────

  async startSession(routineId: string): Promise<GymSession> {
    const today = new Date().toISOString().split('T')[0];
    const session: NewGymSession = {
      id: generateUUID(),
      routineId,
      date: today,
      notes: null,
      strainScore: null,
      kilojoule: null,
      durationMin: null,
      avgHeartRate: null,
      maxHeartRate: null,
      zonesJson: null,
      createdAt: new Date(),
    };
    await db.insert(gymSessions).values(session);
    return session as GymSession;
  },

  async getTodaySession(routineId: string): Promise<GymSession | null> {
    const today = new Date().toISOString().split('T')[0];
    const results = await db
      .select()
      .from(gymSessions)
      .where(and(eq(gymSessions.routineId, routineId), eq(gymSessions.date, today)))
      .limit(1);
    return results[0] ?? null;
  },

  async getRecentSessions(limit = 10): Promise<GymSession[]> {
    return db.select().from(gymSessions).orderBy(desc(gymSessions.date)).limit(limit);
  },

  async getSessionsForDateRange(start: string, end: string): Promise<GymSession[]> {
    return db
      .select()
      .from(gymSessions)
      .where(and(gte(gymSessions.date, start), lte(gymSessions.date, end)))
      .orderBy(desc(gymSessions.date));
  },

  async getSessionWithExercises(sessionId: string): Promise<SessionWithExercises | null> {
    const session = await db.select().from(gymSessions).where(eq(gymSessions.id, sessionId)).limit(1);
    if (!session[0]) return null;

    const routine = await db.select().from(gymRoutines).where(eq(gymRoutines.id, session[0].routineId)).limit(1);
    const allSets = await db.select().from(gymSets).where(eq(gymSets.sessionId, sessionId)).orderBy(gymSets.setNumber);
    const exerciseIds = [...new Set(allSets.map(s => s.exerciseId))];

    const exercisesWithSets: SessionWithExercises['exercises'] = [];
    for (const exId of exerciseIds) {
      const exercise = await db.select().from(gymExercises).where(eq(gymExercises.id, exId)).limit(1);
      if (exercise[0]) {
        exercisesWithSets.push({
          exercise: exercise[0],
          sets: allSets.filter(s => s.exerciseId === exId),
        });
      }
    }

    return {
      ...session[0],
      routineName: routine[0]?.name ?? 'Unknown',
      exercises: exercisesWithSets,
    };
  },

  async getAllSessionsWithRoutines(): Promise<Array<GymSession & { routineName: string; exerciseCount: number; totalVolume: number }>> {
    const sessions = await db.select().from(gymSessions).orderBy(desc(gymSessions.date));
    const result = [];

    for (const session of sessions) {
      const routine = await db.select().from(gymRoutines).where(eq(gymRoutines.id, session.routineId)).limit(1);
      const allSets = await db.select().from(gymSets).where(eq(gymSets.sessionId, session.id));
      const exerciseIds = [...new Set(allSets.map(s => s.exerciseId))];
      const totalVolume = allSets.reduce((acc, s) => acc + s.reps * s.weightKg, 0);

      result.push({
        ...session,
        routineName: routine[0]?.name ?? 'Unknown',
        exerciseCount: exerciseIds.length,
        totalVolume,
      });
    }

    return result;
  },

  // ── Hermes Integration ────────────────────────────────────────────────────

  async createSessionFromHermes(data: {
    routineName: string;
    date: string;
    strainScore?: number;
    kilojoule?: number;
    durationMin?: number;
    avgHeartRate?: number;
    maxHeartRate?: number;
    zones?: Zones;
    exercises: Array<{
      name: string;
      sets: Array<{ reps: number; weightKg: number }>;
    }>;
  }): Promise<GymSession> {
    const routine = await this.getOrCreateRoutine(data.routineName);

    const session: NewGymSession = {
      id: generateUUID(),
      routineId: routine.id,
      date: data.date,
      strainScore: data.strainScore ?? null,
      kilojoule: data.kilojoule ?? null,
      durationMin: data.durationMin ?? null,
      avgHeartRate: data.avgHeartRate ?? null,
      maxHeartRate: data.maxHeartRate ?? null,
      zonesJson: data.zones ? JSON.stringify(data.zones) : null,
      notes: null,
      createdAt: new Date(),
    };
    await db.insert(gymSessions).values(session);

    for (const exData of data.exercises) {
      const exercise = await this.getOrCreateExercise(routine.id, exData.name);

      for (let i = 0; i < exData.sets.length; i++) {
        const setData = exData.sets[i];
        const set: NewGymSet = {
          id: generateUUID(),
          sessionId: session.id,
          exerciseId: exercise.id,
          setNumber: i + 1,
          reps: setData.reps,
          weightKg: setData.weightKg,
          createdAt: new Date(),
        };
        await db.insert(gymSets).values(set);
      }
    }

    return session as GymSession;
  },

  // ── Sets ──────────────────────────────────────────────────────────────────

  async logSet(input: {
    sessionId: string;
    exerciseId: string;
    setNumber: number;
    reps: number;
    weightKg: number;
  }): Promise<GymSet> {
    const set: NewGymSet = {
      id: generateUUID(),
      sessionId: input.sessionId,
      exerciseId: input.exerciseId,
      setNumber: input.setNumber,
      reps: input.reps,
      weightKg: input.weightKg,
      createdAt: new Date(),
    };
    await db.insert(gymSets).values(set);
    return set as GymSet;
  },

  async getSetsForSession(sessionId: string): Promise<GymSet[]> {
    return db.select().from(gymSets).where(eq(gymSets.sessionId, sessionId)).orderBy(gymSets.setNumber);
  },

  async getLastSetsForExercise(exerciseId: string, limit = 3): Promise<GymSet[]> {
    const recentSessions = await db
      .select({ sessionId: gymSets.sessionId })
      .from(gymSets)
      .where(eq(gymSets.exerciseId, exerciseId))
      .orderBy(desc(gymSets.createdAt))
      .limit(limit);

    if (recentSessions.length === 0) return [];
    const sessionId = recentSessions[0].sessionId;
    return db
      .select()
      .from(gymSets)
      .where(and(eq(gymSets.exerciseId, exerciseId), eq(gymSets.sessionId, sessionId)))
      .orderBy(gymSets.setNumber);
  },

  async deleteSet(id: string): Promise<void> {
    await db.delete(gymSets).where(eq(gymSets.id, id));
  },

  // ── Progresión ─────────────────────────────────────────────────────────────

  async getExerciseHistory(exerciseId: string, limit = 20): Promise<Array<{
    date: string;
    weightKg: number;
    reps: number;
  }>> {
    const allSets = await db
      .select()
      .from(gymSets)
      .where(eq(gymSets.exerciseId, exerciseId))
      .orderBy(desc(gymSets.createdAt));

    const sessionIds = [...new Set(allSets.map(s => s.sessionId))];
    const sessions = await db
      .select()
      .from(gymSessions)
      .where(inArray(gymSessions.id, sessionIds))
      .orderBy(desc(gymSessions.date))
      .limit(limit);

    const history: Array<{ date: string; weightKg: number; reps: number }> = [];
    for (const sess of sessions) {
      const sessSets = allSets.filter(s => s.sessionId === sess.id);
      for (const s of sessSets) {
        history.push({ date: sess.date, weightKg: s.weightKg, reps: s.reps });
      }
    }

    return history.slice(0, limit);
  },

  async getRoutineExerciseProgress(routineId: string, exerciseName: string): Promise<Array<{
    date: string;
    avgWeight: number;
    totalReps: number;
    sessionCount: number;
  }>> {
    const exercises = await db
      .select()
      .from(gymExercises)
      .where(and(eq(gymExercises.routineId, routineId), eq(gymExercises.name, exerciseName)));

    if (!exercises[0]) return [];

    const allSets = await db
      .select()
      .from(gymSets)
      .where(eq(gymSets.exerciseId, exercises[0].id));

    const sessionIds = [...new Set(allSets.map(s => s.sessionId))];
    if (sessionIds.length === 0) return [];

    const sessions = await db
      .select()
      .from(gymSessions)
      .where(inArray(gymSessions.id, sessionIds))
      .orderBy(gymSessions.date);

    const grouped = new Map<string, { weights: number[]; reps: number[] }>();
    for (const sess of sessions) {
      const sessSets = allSets.filter(s => s.sessionId === sess.id);
      if (!grouped.has(sess.date)) {
        grouped.set(sess.date, { weights: [], reps: [] });
      }
      const entry = grouped.get(sess.date)!;
      for (const s of sessSets) {
        entry.weights.push(s.weightKg);
        entry.reps.push(s.reps);
      }
    }

    return Array.from(grouped.entries()).map(([date, data]) => ({
      date,
      avgWeight: data.weights.reduce((a, b) => a + b, 0) / data.weights.length,
      totalReps: data.reps.reduce((a, b) => a + b, 0),
      sessionCount: sessions.filter(s => s.date === date).length,
    }));
  },

  // ── Progressive overload analysis ─────────────────────────────────────────

  async checkOverloadAlerts(routineId: string): Promise<OverloadAlert[]> {
    const exercises = await this.getExercisesForRoutine(routineId);
    const alerts: OverloadAlert[] = [];

    for (const ex of exercises) {
      const lastSets = await this.getLastSetsForExercise(ex.id);
      if (lastSets.length === 0) continue;

      const allHitMax = lastSets.length >= ex.targetSets &&
        lastSets.every((s) => s.reps >= ex.targetRepsMax);

      if (allHitMax) {
        alerts.push({
          exerciseId: ex.id,
          exerciseName: ex.name,
          currentWeightKg: ex.currentWeightKg,
          nextWeightKg: ex.currentWeightKg + ex.incrementKg,
        });
      }
    }

    return alerts;
  },
};
