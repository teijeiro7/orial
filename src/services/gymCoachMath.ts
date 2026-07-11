/**
 * Pure business-logic helpers for the Gym Coach.
 *
 * These functions contain the domain math (Epley 1RM, exercise-swap
 * equivalence, auto-progression rule) and are intentionally free of any
 * database / I/O so they can be unit-tested precisely. `gymCoachService`
 * wires them to persistence.
 */

/** A minimal shape of a logged set — only what the math needs. */
export type SetSample = { reps: number; weightKg: number };

/**
 * Estimated one-rep max via the Epley formula: `weight * (1 + reps/30)`.
 *
 * Worked examples from the brief:
 *   - 60kg × 10 reps → 80kg
 *   - 24kg × 10 reps → 32kg
 */
export function estimateOneRm(weightKg: number, reps: number): number {
  if (weightKg <= 0) return 0;
  if (reps <= 0) return weightKg;
  return weightKg * (1 + reps / 30);
}

/** Highest estimated 1RM across a list of logged sets (0 when empty). */
export function bestOneRmFromSets(sets: SetSample[]): number {
  return sets.reduce((best, s) => Math.max(best, estimateOneRm(s.weightKg, s.reps)), 0);
}

/**
 * Weight on exercise B that matches the relative intensity currently used on
 * exercise A, using each exercise's estimated 1RM.
 *
 *   intensity = currentWeightFrom / oneRmFrom      (e.g. 60/80 = 75%)
 *   equivalent = intensity * oneRmTo               (e.g. 75% * 32 = 24kg)
 *
 * Equivalently `currentWeightFrom * oneRmTo / oneRmFrom`. Returns 0 when the
 * source 1RM is unknown, to avoid a divide-by-zero.
 */
export function equivalentSwapWeight(
  currentWeightFrom: number,
  oneRmFrom: number,
  oneRmTo: number,
): number {
  if (oneRmFrom <= 0) return 0;
  return (currentWeightFrom * oneRmTo) / oneRmFrom;
}

/**
 * Auto-progression rule: the user must complete AT LEAST `targetSets` sets and
 * every one of them must reach at least `targetRepsMax` reps.
 */
export function qualifiesForIncrement(
  sets: { reps: number }[],
  targetSets: number,
  targetRepsMax: number,
): boolean {
  if (sets.length < targetSets) return false;
  return sets.every((s) => s.reps >= targetRepsMax);
}

/** Rounds a weight to the nearest plate step (default 0.5 kg). */
export function roundToStep(weightKg: number, step = 0.5): number {
  if (step <= 0) return weightKg;
  return Math.round(weightKg / step) * step;
}
