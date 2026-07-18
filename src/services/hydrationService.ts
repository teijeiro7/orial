import { db, expoDb } from './database';
import { hydration, sodiumIntake, type Hydration, type NewHydration, type NewSodiumIntake } from '../../drizzle/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { generateUUID } from '../utils/uuid';
import { hydrationProfileService } from './hydrationProfileService';
import { writeHydrationBaseline } from './nfcWaterQueue';
import { todayDateString, dateString } from '../utils/date';

const SODIO_PER_LITER_EXTRA = 2300; // mg de sodio que requieren 1L extra

async function getOrCreateForDate(date: string): Promise<Hydration> {
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

async function getOrCreateToday(): Promise<Hydration> {
  const today = todayDateString();
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

async function addWater(date: string, liters: number, beverageType: 'water' | 'soda_zero' | 'tea' | 'coffee' | 'other' = 'water'): Promise<void> {
  // Ensure a row exists for this date before the atomic increment below.
  await getOrCreateForDate(date);

  // Different beverages have different hydration effectiveness
  const effectivenessMap = {
    water: 1.0,
    soda_zero: 0.7,
    tea: 0.95,
    coffee: 0.9,
    other: 0.8,
  };

  const effectiveLiters = liters * effectivenessMap[beverageType];

  // Atomic increment via raw SQL — avoids the read-then-write race where two
  // concurrent addWater calls both read the same starting value and one
  // overwrite silently loses the other's intake. `updated_at` is an integer
  // "timestamp" column (Drizzle stores/reads it in whole seconds), so it must
  // be written in seconds here too, not milliseconds.
  await expoDb.runAsync(
    `UPDATE hydration SET consumed_liters = consumed_liters + ?, effective_liters = effective_liters + ?, updated_at = ? WHERE date = ?`,
    [liters, effectiveLiters, Math.floor(Date.now() / 1000), date],
  );

  try {
    const updated = await getOrCreateForDate(date);
    await writeHydrationBaseline(date, updated.consumedLiters || 0);
  } catch (error) {
    console.warn('Failed to write hydration baseline:', error);
  }
}

async function addSodiumIntake(entry: Omit<NewSodiumIntake, 'id' | 'createdAt'>): Promise<void> {
  const newEntry: NewSodiumIntake = {
    ...entry,
    id: generateUUID(),
    createdAt: new Date(),
  };

  await db.insert(sodiumIntake).values(newEntry);
  await recalculateHydrationTarget(entry.date);
}

async function recalculateHydrationTarget(date: string): Promise<void> {
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
async function getDailyTarget(): Promise<number> {
  return hydrationProfileService.getDynamicBaseTarget();
}

/** Itemized breakdown (base/age/exercise/caffeine/stimulant) for UI display. */
async function getTargetBreakdown() {
  return hydrationProfileService.getTargetBreakdown();
}

/**
 * Recalculates and persists today's (or a given date's) target from the
 * current hydration profile plus any sodium intake for that date. Call this
 * after the hydration profile changes so the stored target stays in sync.
 */
async function recalculateTarget(date?: string): Promise<void> {
  const targetDate = date || todayDateString();
  await recalculateHydrationTarget(targetDate);
}

/** Logs a water intake in milliliters for today. Thin convenience wrapper around `addWater`. */
async function logWater(ml: number, beverageType?: 'water' | 'soda_zero' | 'tea' | 'coffee' | 'other'): Promise<void> {
  const today = todayDateString();
  await addWater(today, ml / 1000, beverageType);
}

async function getProgress(date?: string): Promise<{ current: number; target: number; percentage: number; consumedLiters: number }> {
  const targetDate = date || todayDateString();
  const record = await getOrCreateForDate(targetDate);

  return {
    current: record.effectiveLiters || 0,
    target: record.targetLiters || 3.0,
    percentage: Math.min(100, ((record.effectiveLiters || 0) / (record.targetLiters || 3.0)) * 100),
    consumedLiters: record.consumedLiters || 0,
  };
}

async function getHistory(days: number = 7): Promise<Hydration[]> {
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startDate = dateString(start);

  return db
    .select()
    .from(hydration)
    .where(gte(hydration.date, startDate))
    .orderBy(hydration.date);
}

export const hydrationService = {
  getOrCreateToday,
  addWater,
  addSodiumIntake,
  recalculateHydrationTarget,
  getDailyTarget,
  getTargetBreakdown,
  recalculateTarget,
  logWater,
  getProgress,
  getHistory,
};
