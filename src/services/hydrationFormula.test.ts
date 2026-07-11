import { calculateHydrationTarget, getHydrationBreakdown } from './hydrationFormula';
import type { HydrationProfile } from '../../drizzle/schema';

/**
 * Builds a full HydrationProfile with sane defaults, overridable per test so
 * each case isolates the term it's exercising.
 */
function makeProfile(overrides: Partial<HydrationProfile> = {}): HydrationProfile {
  return {
    id: 'default',
    weightKg: 70,
    ageYears: 25,
    gender: 'male',
    trainingHoursPerDay: 1,
    caffeineMgPerDay: 0,
    stimulantMeds: false,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('calculateHydrationTarget', () => {
  describe('base weight term (33ml per kg)', () => {
    it('computes 0.033L per kg of body weight', () => {
      const profile = makeProfile({
        weightKg: 100,
        ageYears: 30,
        trainingHoursPerDay: 0,
        caffeineMgPerDay: 0,
        stimulantMeds: false,
      });

      expect(calculateHydrationTarget(profile)).toBe(3.3);
    });

    it('scales with weight (each result independently rounded to 1 decimal)', () => {
      const light = makeProfile({ weightKg: 50, ageYears: 30, trainingHoursPerDay: 0, caffeineMgPerDay: 0, stimulantMeds: false });
      const heavy = makeProfile({ weightKg: 80, ageYears: 30, trainingHoursPerDay: 0, caffeineMgPerDay: 0, stimulantMeds: false });

      // 50*0.033=1.65 → 1.7 ; 80*0.033=2.64 → 2.6
      expect(calculateHydrationTarget(light)).toBe(1.7);
      expect(calculateHydrationTarget(heavy)).toBe(2.6);
    });
  });

  describe('age term (> 50 years)', () => {
    it('adds no bonus at exactly 50 years (boundary is exclusive)', () => {
      const at50 = makeProfile({ ageYears: 50, trainingHoursPerDay: 0, caffeineMgPerDay: 0, stimulantMeds: false });
      const at51 = makeProfile({ ageYears: 51, trainingHoursPerDay: 0, caffeineMgPerDay: 0, stimulantMeds: false });

      const diff = calculateHydrationTarget(at51) - calculateHydrationTarget(at50);
      expect(diff).toBeCloseTo(0.3, 5);
    });

    it('adds +0.3L for ages well above 50', () => {
      const young = makeProfile({ ageYears: 30, trainingHoursPerDay: 0, caffeineMgPerDay: 0, stimulantMeds: false });
      const old = makeProfile({ ageYears: 65, trainingHoursPerDay: 0, caffeineMgPerDay: 0, stimulantMeds: false });

      const diff = calculateHydrationTarget(old) - calculateHydrationTarget(young);
      expect(diff).toBeCloseTo(0.3, 5);
    });
  });

  describe('exercise term (500ml per training hour)', () => {
    it('adds 0.5L per hour of daily training', () => {
      const noTraining = makeProfile({ trainingHoursPerDay: 0, caffeineMgPerDay: 0, stimulantMeds: false });
      const twoHours = makeProfile({ trainingHoursPerDay: 2, caffeineMgPerDay: 0, stimulantMeds: false });

      const diff = calculateHydrationTarget(twoHours) - calculateHydrationTarget(noTraining);
      expect(diff).toBeCloseTo(1.0, 5);
    });
  });

  describe('caffeine term (100ml per 100mg)', () => {
    it('adds +0.1L per 100mg of daily caffeine', () => {
      const noCaffeine = makeProfile({ trainingHoursPerDay: 0, caffeineMgPerDay: 0, stimulantMeds: false });
      const highCaffeine = makeProfile({ trainingHoursPerDay: 0, caffeineMgPerDay: 300, stimulantMeds: false });

      const diff = calculateHydrationTarget(highCaffeine) - calculateHydrationTarget(noCaffeine);
      expect(diff).toBeCloseTo(0.3, 5);
    });
  });

  describe('stimulant meds term', () => {
    it('adds a flat +0.3L when the user takes stimulant medication', () => {
      const without = makeProfile({ trainingHoursPerDay: 0, caffeineMgPerDay: 0, stimulantMeds: false });
      const withMeds = makeProfile({ trainingHoursPerDay: 0, caffeineMgPerDay: 0, stimulantMeds: true });

      const diff = calculateHydrationTarget(withMeds) - calculateHydrationTarget(without);
      expect(diff).toBeCloseTo(0.3, 5);
    });
  });

  describe('combined formula', () => {
    it('matches the documented example (70kg, 1h training, 200mg caffeine)', () => {
      const profile = makeProfile({
        weightKg: 70,
        ageYears: 25,
        trainingHoursPerDay: 1,
        caffeineMgPerDay: 200,
        stimulantMeds: false,
      });

      // 70*0.033=2.31 + 1*0.5=0.5 + (200/100)*0.1=0.2 => 3.01 → rounds to 3.0
      expect(calculateHydrationTarget(profile)).toBe(3.0);
    });

    it('sums every applicable term for an older, active, caffeinated, medicated profile', () => {
      const profile = makeProfile({
        weightKg: 80,
        ageYears: 55,
        trainingHoursPerDay: 2,
        caffeineMgPerDay: 400,
        stimulantMeds: true,
      });

      // 80*0.033=2.64 + age(0.3) + 2*0.5=1.0 + (400/100)*0.1=0.4 + stimulant(0.3) = 4.64 → rounds to 4.6
      expect(calculateHydrationTarget(profile)).toBe(4.6);
    });
  });

  describe('rounding', () => {
    it('rounds the total to 1 decimal place', () => {
      const profile = makeProfile({
        weightKg: 61.5,
        ageYears: 25,
        trainingHoursPerDay: 0.3,
        caffeineMgPerDay: 0,
        stimulantMeds: false,
      });

      const result = calculateHydrationTarget(profile);
      expect(Number.isInteger(result * 10)).toBe(true);
    });
  });
});

describe('getHydrationBreakdown', () => {
  it('itemizes each term and matches the total returned by calculateHydrationTarget', () => {
    const profile = makeProfile({
      weightKg: 70,
      ageYears: 55,
      trainingHoursPerDay: 1,
      caffeineMgPerDay: 200,
      stimulantMeds: true,
    });

    const breakdown = getHydrationBreakdown(profile);

    expect(breakdown.base).toBeCloseTo(2.3, 1);
    expect(breakdown.ageBonus).toBeCloseTo(0.3, 5);
    expect(breakdown.exercise).toBeCloseTo(0.5, 1);
    expect(breakdown.caffeine).toBeCloseTo(0.2, 1);
    expect(breakdown.stimulant).toBeCloseTo(0.3, 5);
    expect(breakdown.total).toBe(calculateHydrationTarget(profile));
  });

  it('zeroes out terms that do not apply', () => {
    const profile = makeProfile({
      weightKg: 70,
      ageYears: 25,
      trainingHoursPerDay: 0,
      caffeineMgPerDay: 0,
      stimulantMeds: false,
    });

    const breakdown = getHydrationBreakdown(profile);

    expect(breakdown.ageBonus).toBe(0);
    expect(breakdown.exercise).toBe(0);
    expect(breakdown.caffeine).toBe(0);
    expect(breakdown.stimulant).toBe(0);
  });
});
