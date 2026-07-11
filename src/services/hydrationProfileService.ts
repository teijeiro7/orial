import { db } from './database';
import { hydrationProfile } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import type { HydrationProfile, NewHydrationProfile } from '../../drizzle/schema';
import { calculateHydrationTarget, getHydrationBreakdown, type HydrationTargetBreakdown } from './hydrationFormula';

export type { HydrationTargetBreakdown };

const DEFAULT_PROFILE: Omit<HydrationProfile, 'id'> = {
  weightKg: 70,
  ageYears: 25,
  gender: 'male',
  trainingHoursPerDay: 1,
  caffeineMgPerDay: 0,
  stimulantMeds: false,
  updatedAt: new Date(),
};

export const hydrationProfileService = {
  async getProfile(): Promise<HydrationProfile> {
    const results = await db.select().from(hydrationProfile).where(eq(hydrationProfile.id, 'default'));
    if (results[0]) return results[0];

    const newProfile: NewHydrationProfile = {
      id: 'default',
      ...DEFAULT_PROFILE,
    };
    await db.insert(hydrationProfile).values(newProfile);
    return newProfile as HydrationProfile;
  },

  async updateProfile(updates: Partial<Omit<HydrationProfile, 'id'>>): Promise<void> {
    await this.getProfile(); // ensure exists
    await db
      .update(hydrationProfile)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(hydrationProfile.id, 'default'));
  },

  /**
   * Dynamic daily water target (liters) based on biometrics. See
   * `hydrationFormula.ts` for the term-by-term breakdown and rationale.
   */
  calculateHydrationTarget,

  /** Itemized breakdown (base/age/exercise/caffeine/stimulant) for UI display. */
  getHydrationBreakdown,

  async getDynamicBaseTarget(): Promise<number> {
    const profile = await this.getProfile();
    return this.calculateHydrationTarget(profile);
  },

  /** Current profile's target, itemized — used to render the calculation breakdown. */
  async getTargetBreakdown(): Promise<HydrationTargetBreakdown> {
    const profile = await this.getProfile();
    return this.getHydrationBreakdown(profile);
  },
};
