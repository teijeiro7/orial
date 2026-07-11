import type { HydrationProfile } from '../../drizzle/schema';

/** Terms feeding into a computed daily hydration target, in liters. */
export interface HydrationTargetBreakdown {
  /** 33ml per kg of body weight. */
  base: number;
  /** +0.3L when age is over 50. */
  ageBonus: number;
  /** +0.5L per hour of daily training. */
  exercise: number;
  /** +0.1L per 100mg of daily caffeine. */
  caffeine: number;
  /** Flat +0.3L when taking stimulant medication. */
  stimulant: number;
  /** Sum of all terms, rounded to 1 decimal — matches {@link calculateHydrationTarget}. */
  total: number;
}

const ML_PER_KG = 0.033;
const AGE_THRESHOLD_YEARS = 50;
const AGE_BONUS_LITERS = 0.3;
const LITERS_PER_TRAINING_HOUR = 0.5;
const CAFFEINE_STEP_MG = 100;
const CAFFEINE_STEP_LITERS = 0.1;
const STIMULANT_BONUS_LITERS = 0.3;

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Dynamic daily hydration target (liters), inspired by Vitality.
 *
 * Pure function of the profile's biometrics — no I/O. Climate/geolocation
 * adjustment is explicitly out of scope for this task.
 */
export function calculateHydrationTarget(profile: HydrationProfile): number {
  let liters = profile.weightKg * ML_PER_KG;

  if (profile.ageYears > AGE_THRESHOLD_YEARS) liters += AGE_BONUS_LITERS;

  liters += profile.trainingHoursPerDay * LITERS_PER_TRAINING_HOUR;
  liters += (profile.caffeineMgPerDay / CAFFEINE_STEP_MG) * CAFFEINE_STEP_LITERS;

  if (profile.stimulantMeds) liters += STIMULANT_BONUS_LITERS;

  return roundToOneDecimal(liters);
}

/** Itemized version of {@link calculateHydrationTarget}, for UI breakdowns. */
export function getHydrationBreakdown(profile: HydrationProfile): HydrationTargetBreakdown {
  return {
    base: roundToOneDecimal(profile.weightKg * ML_PER_KG),
    ageBonus: profile.ageYears > AGE_THRESHOLD_YEARS ? AGE_BONUS_LITERS : 0,
    exercise: roundToOneDecimal(profile.trainingHoursPerDay * LITERS_PER_TRAINING_HOUR),
    caffeine: roundToOneDecimal((profile.caffeineMgPerDay / CAFFEINE_STEP_MG) * CAFFEINE_STEP_LITERS),
    stimulant: profile.stimulantMeds ? STIMULANT_BONUS_LITERS : 0,
    total: calculateHydrationTarget(profile),
  };
}
