import { db } from './database';
import {
  gymRoutines,
  gymExercises,
  gymSessions,
  gymSets,
} from '../../drizzle/schema';
import { eq, desc, and } from 'drizzle-orm';
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

export const gymService = {
  // ── Routines ──────────────────────────────────────────────────────────────

  async getRoutines(): Promise<GymRoutine[]> {
    return db.select().from(gymRoutines).orderBy(gymRoutines.createdAt);
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
    // Get last N sessions that contain this exercise, then their sets
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

  // ── Progressive overload analysis ─────────────────────────────────────────

  async checkOverloadAlerts(routineId: string): Promise<OverloadAlert[]> {
    const exercises = await this.getExercisesForRoutine(routineId);
    const alerts: OverloadAlert[] = [];

    for (const ex of exercises) {
      const lastSets = await this.getLastSetsForExercise(ex.id);
      if (lastSets.length === 0) continue;

      // All sets must have hit targetRepsMax to trigger increment
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
