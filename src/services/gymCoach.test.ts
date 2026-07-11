import {
  estimateOneRm,
  bestOneRmFromSets,
  equivalentSwapWeight,
  qualifiesForIncrement,
  roundToStep,
} from './gymCoachMath';

describe('gymCoach — Epley 1RM (estimateOneRm)', () => {
  it('matches the brief worked example: 60kg x 10 reps ≈ 80kg', () => {
    expect(estimateOneRm(60, 10)).toBeCloseTo(80, 5);
  });

  it('matches the brief worked example: 24kg x 10 reps ≈ 32kg (dumbbells per hand)', () => {
    expect(estimateOneRm(24, 10)).toBeCloseTo(32, 5);
  });

  it('applies the raw Epley formula weight*(1+reps/30) for a single rep', () => {
    // Epley intentionally returns slightly above the lifted weight at 1 rep
    expect(estimateOneRm(100, 1)).toBeCloseTo(100 * (1 + 1 / 30), 5);
  });

  it('returns 0 when weight is 0', () => {
    expect(estimateOneRm(0, 10)).toBe(0);
  });

  it('returns the plain weight when reps is 0 (no work performed above the bar)', () => {
    expect(estimateOneRm(50, 0)).toBe(50);
  });
});

describe('gymCoach — bestOneRmFromSets', () => {
  it('returns the highest estimated 1RM across logged sets', () => {
    const sets = [
      { reps: 10, weightKg: 60 }, // 80
      { reps: 8, weightKg: 62 }, // 62 * 1.2667 = 78.53
    ];
    expect(bestOneRmFromSets(sets)).toBeCloseTo(80, 5);
  });

  it('returns 0 for an empty set list', () => {
    expect(bestOneRmFromSets([])).toBe(0);
  });
});

describe('gymCoach — equivalentSwapWeight', () => {
  it('matches the brief worked example: Press Banca 60kg → Mancuernas 24kg', () => {
    // Banca: current 60kg, 1RM 80kg (75% intensity)
    // Mancuernas: 1RM 32kg → 75% of 32 = 24kg
    expect(equivalentSwapWeight(60, 80, 32)).toBeCloseTo(24, 5);
  });

  it('preserves relative intensity (weight ratio equals 1RM ratio)', () => {
    // 24 / 60 === 32 / 80
    const equivalent = equivalentSwapWeight(60, 80, 32);
    expect(equivalent / 60).toBeCloseTo(32 / 80, 5);
  });

  it('returns 0 when the source 1RM is unknown (avoids divide-by-zero)', () => {
    expect(equivalentSwapWeight(60, 0, 32)).toBe(0);
  });
});

describe('gymCoach — qualifiesForIncrement (auto-progression rule)', () => {
  const targetSets = 3;
  const targetRepsMax = 12;

  it('increments when every target set hits at least the max reps', () => {
    const sets = [{ reps: 12 }, { reps: 12 }, { reps: 13 }];
    expect(qualifiesForIncrement(sets, targetSets, targetRepsMax)).toBe(true);
  });

  it('does NOT increment when any set is below the max reps', () => {
    const sets = [{ reps: 12 }, { reps: 10 }, { reps: 12 }];
    expect(qualifiesForIncrement(sets, targetSets, targetRepsMax)).toBe(false);
  });

  it('does NOT increment when fewer than targetSets were completed', () => {
    const sets = [{ reps: 12 }, { reps: 12 }];
    expect(qualifiesForIncrement(sets, targetSets, targetRepsMax)).toBe(false);
  });

  it('increments when more than targetSets are logged and all hit the max', () => {
    const sets = [{ reps: 12 }, { reps: 12 }, { reps: 12 }, { reps: 12 }];
    expect(qualifiesForIncrement(sets, targetSets, targetRepsMax)).toBe(true);
  });

  it('does NOT increment with no sets logged', () => {
    expect(qualifiesForIncrement([], targetSets, targetRepsMax)).toBe(false);
  });
});

describe('gymCoach — roundToStep', () => {
  it('rounds to the nearest 0.5 kg plate step by default', () => {
    expect(roundToStep(37.4)).toBe(37.5);
    expect(roundToStep(24.24)).toBe(24);
  });
});
