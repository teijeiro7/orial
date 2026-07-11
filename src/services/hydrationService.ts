import { db } from './database';
import { hydration, sodiumIntake, type Hydration, type NewHydration, type NewSodiumIntake } from '../../drizzle/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { generateUUID } from '../utils/uuid';
import { hydrationProfileService } from './hydrationProfileService';

const SODIO_PER_LITER_EXTRA = 2300; // mg de sodio que requieren 1L extra

export class HydrationService {
  private static instance: HydrationService;

  static getInstance(): HydrationService {
    if (!HydrationService.instance) {
      HydrationService.instance = new HydrationService();
    }
    return HydrationService.instance;
  }

  async getOrCreateToday(): Promise<Hydration> {
    const today = new Date().toISOString().split('T')[0];
    const existing = await db.select().from(hydration).where(eq(hydration.date, today)).limit(1);

    if (existing[0]) return existing[0];

    const baseTarget = await hydrationProfileService.getDynamicBaseTarget();
    const newRecord: NewHydration = {
      date: today,
      targetLiters: baseTarget,
      consumedLiters: 0,
      effectiveLiters: 0,
      sodiumMg: 0,
      extraLitersFromSodium: 0,
      updatedAt: new Date(),
    };

    await db.insert(hydration).values(newRecord);
    return (await db.select().from(hydration).where(eq(hydration.date, today)).limit(1))[0];
  }

  async addWater(date: string, liters: number, beverageType: 'water' | 'soda_zero' | 'tea' | 'coffee' | 'other' = 'water'): Promise<void> {
    const record = await this.getOrCreateForDate(date);
    
    // Different beverages have different hydration effectiveness
    const effectivenessMap = {
      water: 1.0,
      soda_zero: 0.7,
      tea: 0.95,
      coffee: 0.9,
      other: 0.8,
    };

    const effectiveLiters = liters * effectivenessMap[beverageType];
    
    await db.update(hydration)
      .set({
        consumedLiters: (record.consumedLiters || 0) + liters,
        effectiveLiters: (record.effectiveLiters || 0) + effectiveLiters,
        updatedAt: new Date(),
      })
      .where(eq(hydration.date, date));
  }

  async addSodiumIntake(entry: Omit<NewSodiumIntake, 'id' | 'createdAt'>): Promise<void> {
    const newEntry: NewSodiumIntake = {
      ...entry,
      id: generateUUID(),
      createdAt: new Date(),
    };

    await db.insert(sodiumIntake).values(newEntry);
    await this.recalculateHydrationTarget(entry.date);
  }

  async recalculateHydrationTarget(date: string): Promise<void> {
    const sodiumEntries = await db
      .select()
      .from(sodiumIntake)
      .where(eq(sodiumIntake.date, date));

    const totalSodium = sodiumEntries.reduce((sum, entry) => sum + (entry.sodiumMg || 0), 0);
    const extraLiters = Math.max(0, totalSodium / SODIO_PER_LITER_EXTRA);
    const baseTarget = await hydrationProfileService.getDynamicBaseTarget();

    await db.update(hydration)
      .set({
        sodiumMg: totalSodium,
        extraLitersFromSodium: extraLiters,
        targetLiters: baseTarget + extraLiters,
        updatedAt: new Date(),
      })
      .where(eq(hydration.date, date));
  }

  /**
   * Dynamic daily water target (liters), computed live from the current
   * hydration profile — not the (possibly stale) persisted `hydration.targetLiters`.
   * Use this to reflect profile changes immediately, e.g. in the dashboard widget.
   */
  async getDailyTarget(): Promise<number> {
    return hydrationProfileService.getDynamicBaseTarget();
  }

  /** Itemized breakdown (base/age/exercise/caffeine/stimulant) for UI display. */
  async getTargetBreakdown() {
    return hydrationProfileService.getTargetBreakdown();
  }

  /**
   * Recalculates and persists today's (or a given date's) target from the
   * current hydration profile plus any sodium intake for that date. Call this
   * after the hydration profile changes so the stored target stays in sync.
   */
  async recalculateTarget(date?: string): Promise<void> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    await this.recalculateHydrationTarget(targetDate);
  }

  /** Logs a water intake in milliliters for today. Thin convenience wrapper around `addWater`. */
  async logWater(ml: number, beverageType?: 'water' | 'soda_zero' | 'tea' | 'coffee' | 'other'): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    await this.addWater(today, ml / 1000, beverageType);
  }

  async getProgress(date?: string): Promise<{ current: number; target: number; percentage: number }> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const record = await this.getOrCreateForDate(targetDate);

    return {
      current: record.effectiveLiters || 0,
      target: record.targetLiters || 3.0,
      percentage: Math.min(100, ((record.effectiveLiters || 0) / (record.targetLiters || 3.0)) * 100),
    };
  }

  async getHistory(days: number = 7): Promise<Hydration[]> {
    const start = new Date();
    start.setDate(start.getDate() - days);
    const startDate = start.toISOString().split('T')[0];

    return db
      .select()
      .from(hydration)
      .where(gte(hydration.date, startDate))
      .orderBy(hydration.date);
  }

  private async getOrCreateForDate(date: string): Promise<Hydration> {
    const existing = await db.select().from(hydration).where(eq(hydration.date, date)).limit(1);

    if (existing[0]) return existing[0];

    const baseTarget = await hydrationProfileService.getDynamicBaseTarget();
    const newRecord: NewHydration = {
      date,
      targetLiters: baseTarget,
      consumedLiters: 0,
      effectiveLiters: 0,
      sodiumMg: 0,
      extraLitersFromSodium: 0,
      updatedAt: new Date(),
    };

    await db.insert(hydration).values(newRecord);
    return (await db.select().from(hydration).where(eq(hydration.date, date)).limit(1))[0];
  }
}

export const hydrationService = HydrationService.getInstance();
