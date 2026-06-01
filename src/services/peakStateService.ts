import type { WhoopDaily } from '../../drizzle/schema';

export type PeakStateResult = {
  peakStartHour: number;   // hour of day (0-23)
  peakEndHour: number;
  label: string;           // e.g. "10:00 – 13:00"
  score: number;           // 0-100
  factors: {
    recovery: number;      // 0-100
    sleep: number;         // 0-100
    hrv: number;           // 0-100
    strain: number;        // 0-100 (inverted — high strain = less peak capacity)
  };
};

/**
 * Estimates the user's peak cognitive window using WHOOP biometrics.
 *
 * Logic:
 * 1. Recovery score drives raw cognitive capacity (direct).
 * 2. Sleep performance shifts the window — poor sleep delays the peak by up to 2h.
 * 3. HRV (normalized) adds precision to the score.
 * 4. Yesterday's strain delays recovery: high strain → later, shorter peak.
 *
 * The baseline peak window is 10:00–13:00 (most people peak mid-morning).
 */
export function calculatePeakState(data: WhoopDaily): PeakStateResult {
  const recovery = data.recoveryScore ?? 50;
  const sleep = data.sleepPerformance ?? 50;
  const hrv = data.hrvRmssdMilli ?? 50;
  const strain = data.strain ?? 10;

  // Normalize HRV: assume 20–120ms is normal range
  const hrvNorm = Math.min(100, Math.max(0, ((hrv - 20) / 100) * 100));

  // Composite score (weighted)
  const score = Math.round(
    recovery * 0.45 +
    sleep * 0.30 +
    hrvNorm * 0.15 +
    (100 - Math.min(100, (strain / 21) * 100)) * 0.10
  );

  // Baseline peak start: 10am. Poor sleep delays it; high strain also delays.
  const sleepDelay = sleep < 50 ? Math.round((50 - sleep) / 25) : 0; // 0–2h
  const strainDelay = strain > 15 ? 1 : 0; // 0–1h
  const peakStartHour = Math.min(14, 10 + sleepDelay + strainDelay);

  // Duration: 3h at full recovery, shorter if tired
  const duration = recovery >= 67 ? 3 : recovery >= 34 ? 2 : 1;
  const peakEndHour = peakStartHour + duration;

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
      hrv: Math.round(hrvNorm),
      strain: Math.round(Math.min(100, (strain / 21) * 100)),
    },
  };
}
