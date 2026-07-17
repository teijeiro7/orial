import { db } from './database';
import { manualMetrics, type ManualMetric, type NewManualMetric } from '../../drizzle/schema';
import { eq, gte, desc } from 'drizzle-orm';
import { todayDateString, dateString } from '../utils/date';

async function getOrCreateForDate(date: string): Promise<ManualMetric> {
  const existing = await db.select().from(manualMetrics).where(eq(manualMetrics.date, date)).limit(1);

  if (existing[0]) return existing[0];

  const newRecord: NewManualMetric = {
    date,
    caloriesIn: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    sodiumMg: null,
    fiberG: null,
    stepsWalk: null,
    stepsConscious: null,
    workoutMinutes: null,
    workoutType: null,
    workoutCalories: null,
    bowelMovement: null,
    bowelVolume: null,
    sleepQuality: null,
    stressLevel: null,
    notes: null,
    updatedAt: new Date(),
  };

  await db.insert(manualMetrics).values(newRecord);
  return (await db.select().from(manualMetrics).where(eq(manualMetrics.date, date)).limit(1))[0];
}

async function updateMetrics(date: string, data: Partial<Omit<NewManualMetric, 'date' | 'updatedAt'>>): Promise<void> {
  await db.update(manualMetrics)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(manualMetrics.date, date));
}

async function getTodayMetrics(): Promise<ManualMetric> {
  const today = todayDateString();
  return getOrCreateForDate(today);
}

async function getHistory(days: number = 14): Promise<ManualMetric[]> {
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startDate = dateString(start);

  return db
    .select()
    .from(manualMetrics)
    .where(gte(manualMetrics.date, startDate))
    .orderBy(desc(manualMetrics.date));
}

async function getCaloriesSummary(days: number = 7): Promise<{
  avgCaloriesIn: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  avgSodium: number;
  daysTracked: number;
}> {
  const history = await getHistory(days);
  const trackedDays = history.filter(m => m.caloriesIn !== null);

  if (trackedDays.length === 0) {
    return {
      avgCaloriesIn: 0,
      avgProtein: 0,
      avgCarbs: 0,
      avgFat: 0,
      avgSodium: 0,
      daysTracked: 0,
    };
  }

  const avg = (field: keyof ManualMetric) =>
    trackedDays.reduce((sum, m) => sum + ((m[field] as number) || 0), 0) / trackedDays.length;

  return {
    avgCaloriesIn: avg('caloriesIn'),
    avgProtein: avg('proteinG'),
    avgCarbs: avg('carbsG'),
    avgFat: avg('fatG'),
    avgSodium: avg('sodiumMg'),
    daysTracked: trackedDays.length,
  };
}

export const manualMetricsService = {
  getOrCreateForDate,
  updateMetrics,
  getTodayMetrics,
  getHistory,
  getCaloriesSummary,
};
