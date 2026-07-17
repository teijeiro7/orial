import {
  levelAt,
  computePeak,
  estimateClearAt,
  willInterfereWithSleep,
  buildTimeline,
  CAFFEINE_HALF_LIFE_HOURS,
  CLEAR_THRESHOLD_MG,
  SLEEP_INTERFERENCE_THRESHOLD_MG,
  MS_PER_HOUR,
  type CaffeineDose,
} from './caffeineCalc';

const T0 = Date.parse('2026-07-11T08:00:00Z');
const hours = (h: number) => h * MS_PER_HOUR;

describe('levelAt', () => {
  it('returns 0 for no doses', () => {
    expect(levelAt([], T0)).toBe(0);
  });

  it('returns the full dose amount at the instant it is logged', () => {
    const doses: CaffeineDose[] = [{ mg: 100, timestampMs: T0 }];
    expect(levelAt(doses, T0)).toBeCloseTo(100, 6);
  });

  it('halves after exactly one half-life (5h)', () => {
    const doses: CaffeineDose[] = [{ mg: 100, timestampMs: T0 }];
    expect(levelAt(doses, T0 + hours(CAFFEINE_HALF_LIFE_HOURS))).toBeCloseTo(50, 6);
  });

  it('quarters after two half-lives (10h)', () => {
    const doses: CaffeineDose[] = [{ mg: 100, timestampMs: T0 }];
    expect(levelAt(doses, T0 + hours(10))).toBeCloseTo(25, 6);
  });

  it('is additive across multiple doses', () => {
    const doses: CaffeineDose[] = [
      { mg: 63, timestampMs: T0 }, // espresso at 08:00
      { mg: 95, timestampMs: T0 + hours(1.5) }, // filter coffee at 09:30
    ];
    const atSecondDose = levelAt(doses, T0 + hours(1.5));
    const firstDoseRemaining = 63 * Math.pow(0.5, 1.5 / CAFFEINE_HALF_LIFE_HOURS);
    expect(atSecondDose).toBeCloseTo(firstDoseRemaining + 95, 6);
  });

  it('excludes doses that have not happened yet relative to the query time', () => {
    const doses: CaffeineDose[] = [{ mg: 100, timestampMs: T0 + hours(1) }];
    expect(levelAt(doses, T0)).toBe(0);
  });

  it('never goes negative no matter how far forward in time', () => {
    const doses: CaffeineDose[] = [{ mg: 100, timestampMs: T0 }];
    expect(levelAt(doses, T0 + hours(1000))).toBeGreaterThanOrEqual(0);
  });
});

describe('computePeak', () => {
  it('returns null when there are no doses', () => {
    expect(computePeak([])).toBeNull();
  });

  it('returns the dose amount and time for a single dose', () => {
    const doses: CaffeineDose[] = [{ mg: 63, timestampMs: T0 }];
    expect(computePeak(doses)).toEqual({ mg: 63, atMs: T0 });
  });

  it('picks the later dose time when it produces a higher combined level', () => {
    // Small early dose, then a big dose soon after — peak should be at the second dose.
    const doses: CaffeineDose[] = [
      { mg: 20, timestampMs: T0 },
      { mg: 160, timestampMs: T0 + hours(0.5) },
    ];
    const peak = computePeak(doses)!;
    expect(peak.atMs).toBe(T0 + hours(0.5));
    const expectedMg = 20 * Math.pow(0.5, 0.5 / CAFFEINE_HALF_LIFE_HOURS) + 160;
    expect(peak.mg).toBeCloseTo(expectedMg, 6);
  });

  it('picks the earlier dose time when a huge early dose dwarfs a small later one', () => {
    const doses: CaffeineDose[] = [
      { mg: 500, timestampMs: T0 },
      { mg: 10, timestampMs: T0 + hours(10) },
    ];
    const peak = computePeak(doses)!;
    expect(peak.atMs).toBe(T0);
    expect(peak.mg).toBeCloseTo(500, 6);
  });
});

describe('estimateClearAt', () => {
  it('returns null when there are no doses', () => {
    expect(estimateClearAt([], T0)).toBeNull();
  });

  it('computes the exact analytical clear time for a single dose', () => {
    const doses: CaffeineDose[] = [{ mg: 100, timestampMs: T0 }];
    const clearAt = estimateClearAt(doses, T0, CLEAR_THRESHOLD_MG)!;

    // Level at the computed clear time should equal the threshold (within fp tolerance).
    expect(levelAt(doses, clearAt)).toBeCloseTo(CLEAR_THRESHOLD_MG, 3);
    // Slightly before, level should still be above threshold.
    expect(levelAt(doses, clearAt - 60_000)).toBeGreaterThan(CLEAR_THRESHOLD_MG);
    // Slightly after, level should be below threshold.
    expect(levelAt(doses, clearAt + 60_000)).toBeLessThan(CLEAR_THRESHOLD_MG);
  });

  it('matches the closed-form hours-to-clear formula', () => {
    const doses: CaffeineDose[] = [{ mg: 100, timestampMs: T0 }];
    const clearAt = estimateClearAt(doses, T0, 5)!;
    const expectedHours = CAFFEINE_HALF_LIFE_HOURS * Math.log2(100 / 5); // log2(20)
    expect(clearAt).toBeCloseTo(T0 + expectedHours * MS_PER_HOUR, 0);
  });

  it('returns the reference time immediately when already below threshold', () => {
    const doses: CaffeineDose[] = [{ mg: 3, timestampMs: T0 }];
    expect(estimateClearAt(doses, T0, CLEAR_THRESHOLD_MG)).toBe(T0);
  });

  it('anchors on the last dose time when it is later than fromMs', () => {
    const doses: CaffeineDose[] = [
      { mg: 60, timestampMs: T0 },
      { mg: 60, timestampMs: T0 + hours(2) },
    ];
    // "fromMs" earlier than the last dose — must still anchor at the last dose.
    const clearAt = estimateClearAt(doses, T0, CLEAR_THRESHOLD_MG)!;
    expect(clearAt).toBeGreaterThan(T0 + hours(2));
  });
});

describe('willInterfereWithSleep', () => {
  it('flags interference when level at bedtime exceeds the threshold', () => {
    // 200mg at 16:00, bedtime 23:00 (7h later): 200 * 0.5^(7/5) ≈ 75.8mg > 20mg
    const doses: CaffeineDose[] = [{ mg: 200, timestampMs: T0 }];
    const bedtime = T0 + hours(7);
    const result = willInterfereWithSleep(doses, bedtime, SLEEP_INTERFERENCE_THRESHOLD_MG);
    expect(result.interfere).toBe(true);
    expect(result.levelAtBedtimeMg).toBeCloseTo(200 * Math.pow(0.5, 7 / 5), 6);
  });

  it('does not flag interference when level at bedtime is below the threshold', () => {
    const doses: CaffeineDose[] = [{ mg: 63, timestampMs: T0 }];
    const bedtime = T0 + hours(15); // 63 * 0.5^3 ≈ 7.9mg < 20mg
    const result = willInterfereWithSleep(doses, bedtime, SLEEP_INTERFERENCE_THRESHOLD_MG);
    expect(result.interfere).toBe(false);
  });

  it('is not flagged when level is exactly at the threshold (strict >)', () => {
    const doses: CaffeineDose[] = [{ mg: 20, timestampMs: T0 }];
    const result = willInterfereWithSleep(doses, T0, 20);
    expect(result.interfere).toBe(false);
  });

  it('returns no interference with no doses logged', () => {
    const result = willInterfereWithSleep([], T0, SLEEP_INTERFERENCE_THRESHOLD_MG);
    expect(result.interfere).toBe(false);
    expect(result.levelAtBedtimeMg).toBe(0);
  });
});

describe('buildTimeline', () => {
  it('returns an empty array when the range is inverted', () => {
    expect(buildTimeline([], T0 + hours(1), T0)).toEqual([]);
  });

  it('samples at the requested step size across the range', () => {
    const doses: CaffeineDose[] = [{ mg: 100, timestampMs: T0 }];
    const timeline = buildTimeline(doses, T0, T0 + hours(1), 30);

    expect(timeline).toHaveLength(3); // t0, t0+30m, t0+60m
    expect(timeline[0]).toEqual({ atMs: T0, mg: 100 });
    expect(timeline[1].atMs).toBe(T0 + 30 * 60_000);
    expect(timeline[2].atMs).toBe(T0 + 60 * 60_000);
    expect(timeline[1].mg).toBeLessThan(timeline[0].mg);
    expect(timeline[2].mg).toBeLessThan(timeline[1].mg);
  });
});
