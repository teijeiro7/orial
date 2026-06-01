import { db } from './database';
import { hydrationProfile } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import type { HydrationProfile, NewHydrationProfile } from '../../drizzle/schema';

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
   * Dynamic daily water target (liters) based on biometrics.
   * Formula: weight(kg) × 0.033
   *   + 0.5L per training hour
   *   + 0.1L per 100mg caffeine
   *   + 0.5L if stimulant meds
   *   − 0.2L if female
   *   + 0.3L if age > 55
   */
  calculateTarget(profile: HydrationProfile): number {
    let target = profile.weightKg * 0.033;
    target += profile.trainingHoursPerDay * 0.5;
    target += (profile.caffeineMgPerDay / 100) * 0.1;
    if (profile.stimulantMeds) target += 0.5;
    if (profile.gender === 'female') target -= 0.2;
    if (profile.ageYears > 55) target += 0.3;
    return Math.max(1.5, Math.round(target * 10) / 10);
  },

  async getDynamicBaseTarget(): Promise<number> {
    const profile = await this.getProfile();
    return this.calculateTarget(profile);
  },
};
