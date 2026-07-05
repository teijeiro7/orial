import type { WhoopDaily } from '../../drizzle/schema';

export type PeakStateResult = {
  peakStartHour: number;
  peakEndHour: number;
  label: string;
  score: number;          // 0-100 composite readiness
  factors: {
    recovery: number;     // WHOOP recovery score 0-100
    sleep: number;        // sleep performance 0-100
    hrv: number;          // HRV normalized 0-100
    strain: number;       // strain load 0-100 (higher = more load)
  };
};

// ── Sub-scorers ────────────────────────────────────────────────────────────

/**
 * HRV (RMSSD) → 0-100.
 * Non-linear: the meaningful range for most adults is 20-80ms.
 * Below 20ms is severe; above 80ms yields diminishing cognitive returns.
 * WHOOP recovery already weights HRV internally, so this is used only as
 * a precision modifier when recovery is available, or a primary signal when not.
 */
function scoreHrv(rmssd: number): number {
  if (rmssd <= 0)  return 0;
  if (rmssd <= 20) return (rmssd / 20) * 35;               // 0-20ms  → 0-35
  if (rmssd <= 40) return 35 + ((rmssd - 20) / 20) * 25;  // 20-40ms → 35-60
  if (rmssd <= 70) return 60 + ((rmssd - 40) / 30) * 28;  // 40-70ms → 60-88
  return Math.min(100, 88 + ((rmssd - 70) / 50) * 12);    // 70-120ms → 88-100
}

/**
 * Resting heart rate → 0-100.
 * Lower is generally better; physiological floor ~35bpm.
 */
function scoreRhr(bpm: number): number {
  if (bpm <= 40) return 100;
  if (bpm <= 55) return 100 - ((bpm - 40) / 15) * 15;   // 40-55 → 100-85
  if (bpm <= 70) return 85  - ((bpm - 55) / 15) * 30;   // 55-70 → 85-55
  if (bpm <= 90) return 55  - ((bpm - 70) / 20) * 40;   // 70-90 → 55-15
  return Math.max(0, 15 - ((bpm - 90) / 20) * 15);      // 90+   → 15-0
}

/**
 * SpO2 → 0-100.
 * Threshold effect: ≥97% is normal, below 94% meaningfully impairs cognition.
 */
function scoreSpo2(pct: number): number {
  if (pct >= 97) return 100;
  if (pct >= 95) return 70 + (pct - 95) * 15;   // 95-97 → 70-100
  if (pct >= 92) return 20 + (pct - 92) * 16.7; // 92-95 → 20-70
  return Math.max(0, pct * 2.2);                 // <92   → 0-20
}

/**
 * Sleep duration (hours) → 0-100.
 * Non-linear: <6h is severely impairing regardless of "performance" quality.
 */
function scoreSleepDuration(hours: number): number {
  if (hours >= 8.5) return 100;
  if (hours >= 7.5) return 90 + (hours - 7.5) * 10;
  if (hours >= 7)   return 78 + (hours - 7)   * 24;
  if (hours >= 6)   return 50 + (hours - 6)   * 28;
  if (hours >= 5)   return 15 + (hours - 5)   * 35;
  return Math.max(0, hours * 3);
}

/**
 * Strain load (WHOOP 0-21) → penalty 0-100.
 * WHOOP scale: <10 light, 10-14 moderate, 14-18 hard, 18-21 overreaching.
 */
function strainPenalty(strain: number): number {
  if (strain <= 8)  return 0;
  if (strain <= 13) return ((strain - 8)  / 5)  * 20;  // 0-20%
  if (strain <= 17) return 20 + ((strain - 13) / 4) * 25; // 20-45%
  return Math.min(65, 45 + ((strain - 17) / 4) * 20);  // 45-65%
}

// ── Main export ────────────────────────────────────────────────────────────

export function calculatePeakState(data: WhoopDaily): PeakStateResult {
  // Raw inputs with sensible defaults when WHOOP hasn't synced
  const recovery   = data.recoveryScore     ?? 50;
  const sleep      = data.sleepPerformance  ?? 50;
  const hrv        = data.hrvRmssdMilli     ?? 50;
  const strain     = data.strain            ?? 10;
  const rhr        = data.restingHeartRate  ?? 60;
  const spo2       = data.spo2Percentage    ?? 97;
  const sleepMs    = data.sleepDurationMilli ?? 25_200_000; // default 7h
  const hadNap     = data.nap               ?? false;

  const sleepHours     = sleepMs / 3_600_000;
  const hrvScore       = scoreHrv(hrv);
  const rhrScore       = scoreRhr(rhr);
  const spo2Score      = scoreSpo2(spo2);
  const sleepDurScore  = scoreSleepDuration(sleepHours + (hadNap ? 0.75 : 0));
  const loadPenalty    = strainPenalty(strain);
  const strainScore    = Math.max(0, 100 - loadPenalty);

  /*
   * WHOOP's recoveryScore already composites HRV + RHR + sleep internally.
   * To avoid double-counting we use it as the primary signal (40%) and
   * supplement with data NOT captured in recovery: raw sleep duration (15%),
   * SpO2 (5%), and previous-day strain load (10%). HRV and RHR each add a
   * small precision modifier (15% + 10%) that tilts the score when recovery
   * seems out of sync with raw biometrics.
   */
  const rawScore =
    recovery     * 0.40 +
    sleep        * 0.05 +   // WHOOP sleep perf is already in recovery; small tiebreaker
    sleepDurScore * 0.15 +  // duration NOT in recovery score
    hrvScore     * 0.15 +   // direct HRV signal
    rhrScore     * 0.10 +   // direct RHR signal
    spo2Score    * 0.05 +   // rarely varies but critical when low
    strainScore  * 0.10;    // prior-day load

  const score = Math.round(Math.min(100, Math.max(0, rawScore)));

  /*
   * Peak window timing — chronobiology model:
   *
   * Humans have a primary cortisol/alertness peak ~1-2h after waking.
   * Most people wake 6:30-8:00 → natural peak 8:00-10:00.
   * We baseline at 09:30 and shift based on quality signals.
   *
   * Delays:
   *   - Poor sleep quality (< 70%): up to +2.5h
   *   - Short sleep (< 7h): up to +1.5h
   *   - High strain (> 12): up to +2h
   *
   * Duration:
   *   - Score ≥ 80: 4h window
   *   - Score ≥ 65: 3h window
   *   - Score ≥ 45: 2h window
   *   - Score <  45: 1h window
   */
  const sleepQualityDelay = sleep < 70 ? ((70 - sleep) / 70) * 2.5 : 0;
  const sleepDurDelay     = sleepHours < 7 ? ((7 - Math.max(0, sleepHours)) / 2) * 1.5 : 0;
  const strainShift       = strain > 12 ? ((strain - 12) / 9) * 2 : 0;

  const totalDelay    = sleepQualityDelay + sleepDurDelay + strainShift;
  const peakStartHour = Math.min(14, Math.round(9.5 + totalDelay));
  const duration      = score >= 80 ? 4 : score >= 65 ? 3 : score >= 45 ? 2 : 1;
  const peakEndHour   = Math.min(23, peakStartHour + duration);

  function fmt(h: number) {
    return `${h.toString().padStart(2, '0')}:00`;
  }

  return {
    peakStartHour,
    peakEndHour,
    label: `${fmt(peakStartHour)} – ${fmt(peakEndHour)}`,
    score,
    factors: {
      recovery,
      sleep,
      hrv:    Math.round(hrvScore),
      strain: Math.round(loadPenalty), // how much strain is penalizing today
    },
  };
}
