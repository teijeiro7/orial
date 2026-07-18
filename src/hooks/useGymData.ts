import { useState, useEffect, useCallback } from 'react';
import { gymService } from '@/src/services/gymService';
import { gymCoachService } from '@/src/services/gymCoachService';
import type { ProgressionResult, SwapAlternative } from '@/src/services/gymCoachService';
import { progressPhotoService } from '@/src/services/progressPhotoService';
import type { ProgressPhoto } from '@/src/services/progressPhotoService';
import type { GymRoutine, GymExercise, GymSession, GymSet } from '../../drizzle/schema';
import type { OverloadAlert } from '@/src/services/gymService';

export interface NewExerciseInput {
  name: string;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  currentWeightKg: number;
  incrementKg: number;
}

/**
 * All data-fetching and business logic for the Gym screen: routines,
 * exercises, active session/sets, overload alerts, exercise swaps,
 * auto-progression, and progress photos. Screen-only UI state (modal
 * visibility, form inputs, which exercise row is expanded) stays in the
 * screen component.
 */
export function useGymData() {
  const [routines, setRoutines] = useState<GymRoutine[]>([]);
  const [routineMeta, setRoutineMeta] = useState<
    Record<string, { exerciseCount: number; lastSessionDaysAgo: number | null }>
  >({});
  const [activeRoutine, setActiveRoutine] = useState<GymRoutine | null>(null);
  const [exercises, setExercises] = useState<GymExercise[]>([]);
  const [activeSession, setActiveSession] = useState<GymSession | null>(null);
  const [sessionSets, setSessionSets] = useState<GymSet[]>([]);
  const [overloadAlerts, setOverloadAlerts] = useState<OverloadAlert[]>([]);
  const [loading, setLoading] = useState(true);

  // Gym Coach: swaps, auto-progression, progress photos
  const [swapFor, setSwapFor] = useState<GymExercise | null>(null);
  const [swapAlternatives, setSwapAlternatives] = useState<SwapAlternative[]>([]);
  const [progressions, setProgressions] = useState<Record<string, ProgressionResult>>({});
  const [finishing, setFinishing] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [timeline, setTimeline] = useState<ProgressPhoto[]>([]);

  const loadRoutines = useCallback(async () => {
    setLoading(true);
    const r = await gymService.getRoutines();
    setRoutines(r);
    const metaEntries = await Promise.all(
      r.map(async (routine) => {
        const [routineExercises, lastSession] = await Promise.all([
          gymService.getExercisesForRoutine(routine.id),
          gymService.getLastSessionForRoutine(routine.id),
        ]);
        const lastSessionDaysAgo = lastSession
          ? Math.floor((Date.now() - new Date(lastSession.date).getTime()) / 86400000)
          : null;
        return [routine.id, { exerciseCount: routineExercises.length, lastSessionDaysAgo }] as const;
      }),
    );
    setRoutineMeta(Object.fromEntries(metaEntries));
    setLoading(false);
  }, []);

  const loadRoutineDetail = useCallback(async (routine: GymRoutine) => {
    const [exs, alerts, session] = await Promise.all([
      gymService.getExercisesForRoutine(routine.id),
      gymService.checkOverloadAlerts(routine.id),
      gymService.getTodaySession(routine.id),
    ]);
    setExercises(exs);
    setOverloadAlerts(alerts);
    if (session) {
      const sets = await gymService.getSetsForSession(session.id);
      setActiveSession(session);
      setSessionSets(sets);
    } else {
      setActiveSession(null);
      setSessionSets([]);
    }
  }, []);

  useEffect(() => {
    loadRoutines();
  }, [loadRoutines]);

  useEffect(() => {
    if (activeRoutine) loadRoutineDetail(activeRoutine);
  }, [activeRoutine, loadRoutineDetail]);

  function getExerciseSets(exerciseId: string) {
    return sessionSets.filter((s) => s.exerciseId === exerciseId);
  }

  /** Returns false (and does nothing) when `name` is blank. */
  async function createRoutine(name: string, emoji: string, days: number[]): Promise<boolean> {
    if (!name.trim()) return false;
    await gymService.createRoutine(name.trim(), emoji, days);
    await loadRoutines();
    return true;
  }

  /** Returns false (and does nothing) when `input.name` is blank. */
  async function createExercise(routine: GymRoutine, input: NewExerciseInput): Promise<boolean> {
    if (!input.name.trim()) return false;
    await gymService.createExercise({
      routineId: routine.id,
      name: input.name.trim(),
      targetSets: input.targetSets,
      targetRepsMin: input.targetRepsMin,
      targetRepsMax: input.targetRepsMax,
      currentWeightKg: input.currentWeightKg,
      incrementKg: input.incrementKg,
    });
    await loadRoutineDetail(routine);
    return true;
  }

  async function startSession() {
    if (!activeRoutine) return;
    const session = await gymService.startSession(activeRoutine.id);
    setActiveSession(session);
    setSessionSets([]);
  }

  /** Returns false when there's no active session or `repsStr` parses to 0. */
  async function logSet(exercise: GymExercise, repsStr: string, weightStr: string): Promise<boolean> {
    if (!activeSession) return false;
    const reps = parseInt(repsStr || '0');
    if (!reps) return false;
    const weight = parseFloat(weightStr || String(exercise.currentWeightKg));

    const setsForExercise = getExerciseSets(exercise.id);
    const set = await gymService.logSet({
      sessionId: activeSession.id,
      exerciseId: exercise.id,
      setNumber: setsForExercise.length + 1,
      reps,
      weightKg: weight,
    });

    setSessionSets((prev) => [...prev, set]);
    return true;
  }

  async function acceptOverload(alert: OverloadAlert) {
    await gymService.updateExerciseWeight(alert.exerciseId, alert.nextWeightKg);
    setOverloadAlerts((prev) => prev.filter((a) => a.exerciseId !== alert.exerciseId));
    if (activeRoutine) await loadRoutineDetail(activeRoutine);
  }

  /** Runs auto-progression for the active session and returns the results (empty if none). */
  async function finishSession(): Promise<ProgressionResult[]> {
    if (!activeSession || !activeRoutine) return [];
    setFinishing(true);
    try {
      const results = await gymCoachService.processCompletedSession(activeSession.id);
      const byExercise: Record<string, ProgressionResult> = {};
      for (const r of results) byExercise[r.exerciseId] = r;
      setProgressions(byExercise);
      await loadRoutineDetail(activeRoutine);
      return results;
    } finally {
      setFinishing(false);
    }
  }

  async function openSwap(exercise: GymExercise) {
    setSwapFor(exercise);
    setSwapAlternatives([]);
    try {
      const alternatives = await gymCoachService.getSwapAlternatives(exercise.id);
      setSwapAlternatives(alternatives);
    } catch {
      setSwapAlternatives([]);
    }
  }

  /** Throws on failure so the caller can surface an error message. */
  async function selectSwap(alternative: SwapAlternative) {
    if (!swapFor || !activeRoutine) return;
    await gymCoachService.applySwap(swapFor.id, alternative.exerciseId);
    setSwapFor(null);
    await loadRoutineDetail(activeRoutine);
  }

  /** Throws on failure so the caller can surface an error message. */
  async function takePhoto(): Promise<string> {
    setPhotoBusy(true);
    try {
      return await progressPhotoService.takePhoto();
    } finally {
      setPhotoBusy(false);
    }
  }

  /** Throws on failure (after clearing the timeline) so the caller can surface an error message. */
  async function openTimeline() {
    setShowTimeline(true);
    try {
      const photos = await progressPhotoService.getTimeline();
      setTimeline(photos);
    } catch (e) {
      setTimeline([]);
      throw e;
    }
  }

  // Session progress: completed sets vs. total sets targeted for this routine.
  const totalTargetSets = exercises.reduce((sum, ex) => sum + ex.targetSets, 0);
  const completedSets = sessionSets.length;
  const sessionProgressPct = totalTargetSets > 0 ? (completedSets / totalTargetSets) * 100 : 0;
  const nextExercise = exercises.find((ex) => getExerciseSets(ex.id).length < ex.targetSets) ?? null;

  return {
    // State
    loading,
    routines,
    routineMeta,
    activeRoutine,
    setActiveRoutine,
    exercises,
    activeSession,
    sessionSets,
    overloadAlerts,
    swapFor,
    setSwapFor,
    swapAlternatives,
    progressions,
    finishing,
    photoBusy,
    showTimeline,
    setShowTimeline,
    timeline,

    // Computed
    getExerciseSets,
    totalTargetSets,
    completedSets,
    sessionProgressPct,
    nextExercise,

    // Actions
    createRoutine,
    createExercise,
    startSession,
    logSet,
    acceptOverload,
    finishSession,
    openSwap,
    selectSwap,
    takePhoto,
    openTimeline,
  };
}
