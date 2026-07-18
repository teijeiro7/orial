import { db } from './database';
import { weightPredictions, bodyMetrics, manualMetrics, hydration, whoopDaily, type WeightPrediction, type NewWeightPrediction } from '../../drizzle/schema';
import { eq, gte, desc, and } from 'drizzle-orm';
import { todayDateString, dateString } from '../utils/date';

// Constants based on Ruben's system
const GLYCOGEN_WATER_RATIO = 3.5; // grams of water per gram of glycogen
const SODIUM_WATER_RETENTION = 0.0015; // kg per mg of sodium
const FIBER_TRANSIT_WEIGHT = 0.5; // kg per 10g fiber

function calculateConfidence(manual: typeof manualMetrics.$inferSelect | undefined, hydrationData: typeof hydration.$inferSelect | undefined, whoop: typeof whoopDaily.$inferSelect | undefined): number {
  let score = 0.3; // Base confidence

  if (manual?.caloriesIn) score += 0.2;
  if (manual?.sodiumMg) score += 0.15;
  if (manual?.carbsG) score += 0.1;
  if (hydrationData?.effectiveLiters) score += 0.1;
  if (whoop?.kilojoule) score += 0.15;

  return Math.min(0.95, score);
}

async function generatePrediction(date: string): Promise<WeightPrediction | null> {
  // Get previous day's actual weight
  const prevDate = new Date(date);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateStr = dateString(prevDate);

  const prevWeight = await db
    .select()
    .from(bodyMetrics)
    .where(eq(bodyMetrics.date, new Date(prevDateStr)))
    .orderBy(desc(bodyMetrics.createdAt))
    .limit(1);

  if (!prevWeight[0]?.weightKg) return null;

  const baseWeight = prevWeight[0].weightKg;

  // Get metrics for the target date
  const [manual, hyd, whoop] = await Promise.all([
    db.select().from(manualMetrics).where(eq(manualMetrics.date, date)).limit(1),
    db.select().from(hydration).where(eq(hydration.date, date)).limit(1),
    db.select().from(whoopDaily).where(eq(whoopDaily.date, date)).limit(1),
  ]);

  const m = manual[0];
  const h = hyd[0];
  const w = whoop[0];

  // Calculate factors
  const factors: string[] = [];
  let predictedDelta = 0;

  // 1. Caloric deficit/surplus (very simplified - 7700 kcal = 1kg)
  if (m?.caloriesIn && w?.kilojoule) {
    const caloriesBurned = (w.kilojoule * 0.239); // kJ to kcal
    const deficit = caloriesBurned - m.caloriesIn;
    const fatChange = deficit / 7700;
    predictedDelta += fatChange;
    factors.push(`Caloric deficit: ${deficit.toFixed(0)} kcal (${fatChange >= 0 ? '-' : '+'}${Math.abs(fatChange * 1000).toFixed(0)}g fat)`);
  }

  // 2. Sodium retention
  if (m?.sodiumMg) {
    const sodiumRetention = m.sodiumMg * SODIUM_WATER_RETENTION;
    predictedDelta += sodiumRetention;
    factors.push(`Sodium retention: +${sodiumRetention.toFixed(2)}kg (${m.sodiumMg}mg)`);
  }

  // 3. Carbohydrate/glycogen changes
  if (m?.carbsG) {
    const glycogenChange = (m.carbsG - 200) / 1000; // Assuming 200g baseline
    const waterChange = glycogenChange * GLYCOGEN_WATER_RATIO;
    predictedDelta += waterChange;
    factors.push(`Glycogen/water: ${waterChange >= 0 ? '+' : ''}${waterChange.toFixed(2)}kg (${m.carbsG}g carbs)`);
  }

  // 4. Fiber/transit
  if (m?.fiberG) {
    const fiberWeight = (m.fiberG / 10) * FIBER_TRANSIT_WEIGHT;
    predictedDelta += fiberWeight;
    factors.push(`Digestive content: +${fiberWeight.toFixed(2)}kg (${m.fiberG}g fiber)`);
  }

  // 5. Hydration status
  if (h) {
    const hydrationDelta = (h.effectiveLiters || 0) - (h.targetLiters || 3);
    predictedDelta += hydrationDelta * 0.3; // Only 30% of hydration difference affects weight
    if (Math.abs(hydrationDelta) > 0.3) {
      factors.push(`Hydration: ${hydrationDelta >= 0 ? '+' : ''}${(hydrationDelta * 0.3).toFixed(2)}kg`);
    }
  }

  // 6. Sleep quality adjustment
  if (w?.sleepPerformance) {
    const sleepFactor = (w.sleepPerformance - 80) / 1000; // Small adjustment
    predictedDelta += sleepFactor;
    if (Math.abs(sleepFactor) > 0.01) {
      factors.push(`Sleep quality: ${sleepFactor >= 0 ? '+' : ''}${sleepFactor.toFixed(3)}kg`);
    }
  }

  const predictedWeight = baseWeight + predictedDelta;
  const confidence = calculateConfidence(m, h, w);
  const rangeSize = (1 - confidence) * 2; // kg

  const prediction: NewWeightPrediction = {
    date,
    actualWeightKg: null, // Will be filled when user weighs in
    predictedWeightKg: predictedWeight,
    predictionRangeLow: predictedWeight - rangeSize,
    predictionRangeHigh: predictedWeight + rangeSize,
    predictedDeltaKg: predictedDelta,
    factors: JSON.stringify(factors),
    confidence,
    updatedAt: new Date(),
  };

  await db.insert(weightPredictions).values(prediction).onConflictDoUpdate({
    target: weightPredictions.date,
    set: prediction,
  });

  return (await db.select().from(weightPredictions).where(eq(weightPredictions.date, date)).limit(1))[0];
}

async function updateActualWeight(date: string, weightKg: number): Promise<void> {
  await db.update(weightPredictions)
    .set({ actualWeightKg: weightKg, updatedAt: new Date() })
    .where(eq(weightPredictions.date, date));
}

async function getTodayPrediction(): Promise<WeightPrediction | null> {
  const today = todayDateString();
  const existing = await db.select().from(weightPredictions).where(eq(weightPredictions.date, today)).limit(1);

  if (existing[0]) return existing[0];
  return generatePrediction(today);
}

async function getHistory(days: number = 14): Promise<WeightPrediction[]> {
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startDate = dateString(start);

  return db
    .select()
    .from(weightPredictions)
    .where(gte(weightPredictions.date, startDate))
    .orderBy(weightPredictions.date);
}

async function getAccuracy(days: number = 14): Promise<{ mae: number; withinRange: number; total: number }> {
  const history = await getHistory(days);
  const withActual = history.filter(p => p.actualWeightKg && p.predictedWeightKg);

  if (withActual.length === 0) return { mae: 0, withinRange: 0, total: 0 };

  let totalError = 0;
  let withinRange = 0;

  for (const p of withActual) {
    const error = Math.abs(p.actualWeightKg! - p.predictedWeightKg!);
    totalError += error;

    if (p.predictionRangeLow && p.predictionRangeHigh) {
      if (p.actualWeightKg! >= p.predictionRangeLow && p.actualWeightKg! <= p.predictionRangeHigh) {
        withinRange++;
      }
    }
  }

  return {
    mae: totalError / withActual.length,
    withinRange,
    total: withActual.length,
  };
}

export const weightPredictionService = {
  generatePrediction,
  updateActualWeight,
  getTodayPrediction,
  getHistory,
  getAccuracy,
};
