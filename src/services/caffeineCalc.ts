/**
 * Pure caffeine pharmacokinetics math — no I/O, no React Native, no Drizzle.
 *
 * Model (as specified by the product brief): each dose decays independently
 * with a fixed half-life starting the instant it's logged (no absorption lag
 * modeled). The total blood level at any time is the sum of every dose's
 * remaining contribution:
 *
 *   level(t) = Σ mg_i * 0.5 ^ ((t - timestamp_i) / halfLifeHours)   for timestamp_i <= t
 *
 * Because every dose shares the same half-life, the sum of exponentials is
 * itself a single exponential once no more doses are added — which is what
 * lets `estimateClearAt` solve for the crossing time analytically instead of
 * simulating forward in a loop.
 */

export const CAFFEINE_HALF_LIFE_HOURS = 5;
export const CLEAR_THRESHOLD_MG = 5;
export const SLEEP_INTERFERENCE_THRESHOLD_MG = 20;
/** Used by logCaffeine's automatic sleep-interference check until a user-configurable bedtime exists. */
export const DEFAULT_BEDTIME_HOUR = 23;

export const MS_PER_HOUR = 60 * 60 * 1000;

export interface CaffeineDose {
  mg: number;
  timestampMs: number;
}

/** Blood caffeine level (mg) contributed by a single dose at a given time. */
function doseContributionAt(dose: CaffeineDose, atMs: number): number {
  if (dose.timestampMs > atMs) return 0; // dose hasn't happened yet
  const hoursElapsed = (atMs - dose.timestampMs) / MS_PER_HOUR;
  return dose.mg * Math.pow(0.5, hoursElapsed / CAFFEINE_HALF_LIFE_HOURS);
}

/** Total blood caffeine level (mg) across all doses at a given instant. */
export function levelAt(doses: CaffeineDose[], atMs: number): number {
  return doses.reduce((sum, dose) => sum + doseContributionAt(dose, atMs), 0);
}

/**
 * Peak level and when it occurred.
 *
 * Between dose events the total level only decreases (each term decays
 * monotonically); it only jumps upward at the instant a new dose is logged.
 * So the global maximum must occur immediately at one of the dose timestamps
 * — we just evaluate the total level at each dose time and take the max.
 */
export function computePeak(doses: CaffeineDose[]): { mg: number; atMs: number } | null {
  if (doses.length === 0) return null;

  return doses.reduce<{ mg: number; atMs: number } | null>((peak, dose) => {
    const mg = levelAt(doses, dose.timestampMs);
    if (!peak || mg > peak.mg) return { mg, atMs: dose.timestampMs };
    return peak;
  }, null);
}

/**
 * Estimated time the total level drops below `thresholdMg`.
 *
 * Evaluated from `referenceMs` = max(fromMs, last dose timestamp) so the
 * curve at that point is guaranteed to be a single clean exponential (no
 * more upward jumps ahead of it), which can be solved analytically:
 *
 *   level(ref) * 0.5 ^ (Δh / halfLife) = threshold
 *   Δh = halfLife * log2(level(ref) / threshold)
 */
export function estimateClearAt(
  doses: CaffeineDose[],
  fromMs: number,
  thresholdMg: number = CLEAR_THRESHOLD_MG,
): number | null {
  if (doses.length === 0) return null;

  const lastDoseMs = Math.max(...doses.map((d) => d.timestampMs));
  const referenceMs = Math.max(fromMs, lastDoseMs);
  const referenceLevel = levelAt(doses, referenceMs);

  if (referenceLevel <= 0) return null;
  if (referenceLevel <= thresholdMg) return referenceMs; // already cleared

  const hoursToClear = CAFFEINE_HALF_LIFE_HOURS * Math.log2(referenceLevel / thresholdMg);
  return referenceMs + hoursToClear * MS_PER_HOUR;
}

export interface SleepInterferenceResult {
  interfere: boolean;
  levelAtBedtimeMg: number;
}

/** Whether blood caffeine will still be above the interference threshold at bedtime. */
export function willInterfereWithSleep(
  doses: CaffeineDose[],
  bedtimeMs: number,
  thresholdMg: number = SLEEP_INTERFERENCE_THRESHOLD_MG,
): SleepInterferenceResult {
  const levelAtBedtimeMg = levelAt(doses, bedtimeMs);
  return { interfere: levelAtBedtimeMg > thresholdMg, levelAtBedtimeMg };
}

export interface TimelinePoint {
  atMs: number;
  mg: number;
}

/** Samples the decay curve every `stepMinutes` between `startMs` and `endMs` (inclusive). */
export function buildTimeline(
  doses: CaffeineDose[],
  startMs: number,
  endMs: number,
  stepMinutes: number = 30,
): TimelinePoint[] {
  if (endMs < startMs) return [];
  const stepMs = stepMinutes * 60 * 1000;
  const points: TimelinePoint[] = [];
  for (let t = startMs; t <= endMs; t += stepMs) {
    points.push({ atMs: t, mg: levelAt(doses, t) });
  }
  return points;
}
