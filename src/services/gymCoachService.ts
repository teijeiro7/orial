import { gymService } from './gymService';
import {
  estimateOneRm,
  bestOneRmFromSets,
  equivalentSwapWeight,
  qualifiesForIncrement,
  roundToStep,
  type SetSample,
} from './gymCoachMath';
import type { GymExercise, GymSet } from '../../drizzle/schema';

// Re-export the pure helpers so callers have a single entry point.
export { estimateOneRm, equivalentSwapWeight } from './gymCoachMath';

/** One weight adjustment produced by evaluating a completed session. */
export type ProgressionResult = {
  exerciseId: string;
  exerciseName: string;
  oldWeight: number;
  newWeight: number;
  reason: string;
};

/** An interchangeable exercise with its intensity-matched weight. */
export type SwapAlternative = {
  exerciseId: string;
  name: string;
  equivalentWeightKg: number;
  oneRmEstimated: number;
};

export type WorkoutPlanItem = {
  exerciseId: string;
  name: string;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  weightKg: number;
};

export type WorkoutPlan = {
  routineId: string;
  routineName: string;
  items: WorkoutPlanItem[];
};

/** Groups a flat list of sets by their exercise id, preserving order. */
function groupByExercise(sets: GymSet[]): Map<string, GymSet[]> {
  const grouped = new Map<string, GymSet[]>();
  for (const set of sets) {
    const bucket = grouped.get(set.exerciseId) ?? [];
    bucket.push(set);
    grouped.set(set.exerciseId, bucket);
  }
  return grouped;
}

/** Resolves an exercise's best-known 1RM: stored estimate, else a target-based fallback. */
function resolveOneRm(exercise: GymExercise): number {
  if (exercise.oneRmEstimated && exercise.oneRmEstimated > 0) return exercise.oneRmEstimated;
  return estimateOneRm(exercise.currentWeightKg, exercise.targetRepsMax);
}

export const gymCoachService = {
  /**
   * Evaluates every exercise trained in `sessionId`. For each one it refreshes
   * the estimated 1RM from the logged sets and, when the auto-progression rule
   * is met (all target sets at ≥ targetRepsMax), bumps `currentWeightKg` by
   * `incrementKg`. Returns the list of weight adjustments made.
   */
  async processCompletedSession(sessionId: string): Promise<ProgressionResult[]> {
    const sets = await gymService.getSetsForSession(sessionId);
    const byExercise = groupByExercise(sets);
    const results: ProgressionResult[] = [];

    for (const [exerciseId, exerciseSets] of byExercise) {
      const exercise = await gymService.getExerciseById(exerciseId);
      if (!exercise) continue;

      const samples: SetSample[] = exerciseSets.map((s) => ({ reps: s.reps, weightKg: s.weightKg }));
      const sessionBestRm = bestOneRmFromSets(samples);
      const patch: Partial<
        Pick<GymExercise, 'currentWeightKg' | 'oneRmEstimated'>
      > = {};

      // Keep the highest 1RM ever observed for this exercise.
      const priorRm = exercise.oneRmEstimated ?? 0;
      if (sessionBestRm > priorRm) patch.oneRmEstimated = sessionBestRm;

      if (qualifiesForIncrement(exerciseSets, exercise.targetSets, exercise.targetRepsMax)) {
        const oldWeight = exercise.currentWeightKg;
        const newWeight = roundToStep(oldWeight + exercise.incrementKg);
        patch.currentWeightKg = newWeight;
        results.push({
          exerciseId,
          exerciseName: exercise.name,
          oldWeight,
          newWeight,
          reason: `Completaste ${exercise.targetSets}x${exercise.targetRepsMax} → peso sube a ${newWeight}kg`,
        });
      }

      if (Object.keys(patch).length > 0) {
        await gymService.updateExercise(exerciseId, patch);
      }
    }

    return results;
  },

  /**
   * Interchangeable exercises (same `swapGroup`) with a weight that matches the
   * relative intensity currently used on `exerciseId`.
   */
  async getSwapAlternatives(exerciseId: string): Promise<SwapAlternative[]> {
    const exercise = await gymService.getExerciseById(exerciseId);
    if (!exercise || !exercise.swapGroup) return [];

    const group = await gymService.getExercisesBySwapGroup(exercise.swapGroup);
    const oneRmFrom = resolveOneRm(exercise);

    return group
      .filter((alt) => alt.id !== exercise.id)
      .map((alt) => {
        const oneRmTo = resolveOneRm(alt);
        return {
          exerciseId: alt.id,
          name: alt.name,
          equivalentWeightKg: roundToStep(
            equivalentSwapWeight(exercise.currentWeightKg, oneRmFrom, oneRmTo),
          ),
          oneRmEstimated: oneRmTo,
        };
      });
  },

  /**
   * Switches the working exercise to `toExerciseId`, setting its weight to the
   * intensity-equivalent of `fromExerciseId` and recording the swap time.
   */
  async applySwap(
    fromExerciseId: string,
    toExerciseId: string,
  ): Promise<{ exerciseId: string; name: string; newWeightKg: number } | null> {
    const from = await gymService.getExerciseById(fromExerciseId);
    const to = await gymService.getExerciseById(toExerciseId);
    if (!from || !to) return null;

    const equivalent = roundToStep(
      equivalentSwapWeight(from.currentWeightKg, resolveOneRm(from), resolveOneRm(to)),
    );
    await gymService.updateExercise(toExerciseId, {
      currentWeightKg: equivalent,
      lastSwappedAt: new Date(),
    });
    return { exerciseId: toExerciseId, name: to.name, newWeightKg: equivalent };
  },

  /** Builds today's plan for a routine using each exercise's current weight. */
  async getNextWorkout(routineId: string): Promise<WorkoutPlan> {
    const [routine, exercises] = await Promise.all([
      gymService.getRoutineById(routineId),
      gymService.getExercisesForRoutine(routineId),
    ]);

    return {
      routineId,
      routineName: routine?.name ?? '',
      items: exercises.map((ex) => ({
        exerciseId: ex.id,
        name: ex.name,
        targetSets: ex.targetSets,
        targetRepsMin: ex.targetRepsMin,
        targetRepsMax: ex.targetRepsMax,
        weightKg: ex.currentWeightKg,
      })),
    };
  },

  /**
   * Estimated 1RM for an exercise from its most recent logged sets (Epley),
   * persisted to `oneRmEstimated`. Returns 0 when there is no logged data.
   */
  async estimateOneRmForExercise(exerciseId: string): Promise<number> {
    const lastSets = await gymService.getLastSetsForExercise(exerciseId);
    const samples: SetSample[] = lastSets.map((s) => ({ reps: s.reps, weightKg: s.weightKg }));
    const oneRm = bestOneRmFromSets(samples);
    if (oneRm > 0) {
      await gymService.updateExercise(exerciseId, { oneRmEstimated: oneRm });
    }
    return oneRm;
  },
};
