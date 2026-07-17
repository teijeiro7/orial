import { db } from './database';
import { nutritionLogs, manualMetrics, sodiumIntake, hydration, type NutritionLog, type NewNutritionLog } from '../../drizzle/schema';
import { eq, desc, gte } from 'drizzle-orm';
import { generateUUID } from '../utils/uuid';
import { manualMetricsService } from './manualMetricsService';
import { hydrationService } from './hydrationService';
import type { OCRResult } from './openclawService';
import { todayDateString, dateString } from '../utils/date';

export interface OpenclawNutritionData {
  date: string;
  totalCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sodiumMg: number;
  fiberG?: number;
  meals?: Array<{
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    sodium: number;
  }>;
}

async function importFromOpenclaw(data: OpenclawNutritionData): Promise<void> {
  // Save to nutrition logs
  const log: NewNutritionLog = {
    id: generateUUID(),
    date: data.date,
    source: 'openclaw',
    totalCalories: data.totalCalories,
    proteinG: data.proteinG,
    carbsG: data.carbsG,
    fatG: data.fatG,
    sodiumMg: data.sodiumMg,
    fiberG: data.fiberG || 0,
    rawData: JSON.stringify(data),
    createdAt: new Date(),
  };

  await db.insert(nutritionLogs).values(log).onConflictDoUpdate({
    target: nutritionLogs.id,
    set: log,
  });

  // Update manual metrics with nutrition data
  await manualMetricsService.updateMetrics(data.date, {
    caloriesIn: data.totalCalories,
    proteinG: data.proteinG,
    carbsG: data.carbsG,
    fatG: data.fatG,
    sodiumMg: data.sodiumMg,
    fiberG: data.fiberG || 0,
  });

  // Update sodium intake records
  if (data.meals && data.meals.length > 0) {
    for (const meal of data.meals) {
      if (meal.sodium > 0) {
        await db.insert(sodiumIntake).values({
          id: generateUUID(),
          date: data.date,
          source: meal.name,
          sodiumMg: meal.sodium,
          mealType: 'meal',
          notes: `${meal.calories} kcal`,
          createdAt: new Date(),
        });
      }
    }

    // Recalculate hydration target based on sodium
    await hydrationService.recalculateHydrationTarget(data.date);
  }
}

/**
 * Logs a single meal captured via Jarvis's OCR/vision analysis (T5).
 *
 * Unlike `importFromOpenclaw` (which overwrites the whole day's totals with
 * an agent-reported summary), a meal photo represents just ONE meal, so its
 * macros are ADDED to whatever is already logged for `date` (defaults to
 * today) rather than replacing it. If no row exists yet for that date, one
 * is created with `source: 'ocr'`.
 */
async function logMeal(result: OCRResult, date: string = todayDateString()): Promise<void> {
  const existingRows = await db.select().from(nutritionLogs).where(eq(nutritionLogs.date, date)).limit(1);
  const existing = existingRows[0];

  const totalCalories = (existing?.totalCalories ?? 0) + result.totalCalories;
  const proteinG = (existing?.proteinG ?? 0) + result.totalProteinG;
  const carbsG = (existing?.carbsG ?? 0) + result.totalCarbsG;
  const fatG = (existing?.fatG ?? 0) + result.totalFatG;

  if (existing) {
    await db
      .update(nutritionLogs)
      .set({ totalCalories, proteinG, carbsG, fatG, rawData: JSON.stringify(result) })
      .where(eq(nutritionLogs.id, existing.id));
    return;
  }

  const log: NewNutritionLog = {
    id: generateUUID(),
    date,
    source: 'ocr',
    totalCalories,
    proteinG,
    carbsG,
    fatG,
    sodiumMg: 0,
    fiberG: 0,
    rawData: JSON.stringify(result),
    createdAt: new Date(),
  };
  await db.insert(nutritionLogs).values(log);
}

async function getTodayNutrition(): Promise<NutritionLog | null> {
  const today = todayDateString();
  const result = await db.select().from(nutritionLogs).where(eq(nutritionLogs.date, today)).limit(1);
  if (result[0]) return result[0];

  // Fallback: build from manualMetrics if nutrition was logged there directly
  const manual = await db.select().from(manualMetrics).where(eq(manualMetrics.date, today)).limit(1);
  const m = manual[0];
  if (!m || (!m.caloriesIn && !m.proteinG && !m.carbsG && !m.fatG)) return null;

  return {
    id: `manual-${today}`,
    date: today,
    source: 'manual',
    totalCalories: m.caloriesIn ?? 0,
    proteinG: m.proteinG ?? 0,
    carbsG: m.carbsG ?? 0,
    fatG: m.fatG ?? 0,
    sodiumMg: m.sodiumMg ?? 0,
    fiberG: m.fiberG ?? 0,
    rawData: null,
    createdAt: m.updatedAt,
  } as NutritionLog;
}

async function getHistory(days: number = 7): Promise<NutritionLog[]> {
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startDate = dateString(start);

  return db
    .select()
    .from(nutritionLogs)
    .where(gte(nutritionLogs.date, startDate))
    .orderBy(desc(nutritionLogs.date));
}

// Parse Openclaw message and extract nutrition data
async function parseOpenclawMessage(message: string): Promise<OpenclawNutritionData | null> {
  const startMarker = '###ORIAL_NUTRITION###';
  const endMarker = '###END_ORIAL###';

  const startIndex = message.indexOf(startMarker);
  const endIndex = message.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    return null;
  }

  const jsonStr = message.substring(startIndex + startMarker.length, endIndex).trim();

  try {
    const data = JSON.parse(jsonStr) as OpenclawNutritionData;

    // Validate required fields
    if (!data.date || !data.totalCalories || !data.proteinG || !data.carbsG || !data.fatG || !data.sodiumMg) {
      console.warn('Openclaw nutrition data missing required fields');
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to parse Openclaw nutrition JSON:', error);
    return null;
  }
}

// Process a full Openclaw message: parse and import
async function processOpenclawMessage(message: string): Promise<boolean> {
  const data = await parseOpenclawMessage(message);
  if (data) {
    await importFromOpenclaw(data);
    return true;
  }
  return false;
}

// Helper for Openclaw agent to format data
function formatForAgent(): string {
  return `
# FORMATO DE RESPUESTA PARA ORIAL APP

Cuando proporciones datos nutricionales del día, usa EXACTAMENTE este formato JSON al final de tu mensaje:

###ORIAL_NUTRITION###
{
  "date": "YYYY-MM-DD",
  "totalCalories": 0,
  "proteinG": 0,
  "carbsG": 0,
  "fatG": 0,
  "sodiumMg": 0,
  "fiberG": 0,
  "meals": [
    {
      "name": "string",
      "calories": 0,
      "protein": 0,
      "carbs": 0,
      "fat": 0,
      "sodium": 0
    }
  ]
}
###END_ORIAL###

Instrucciones:
- La sección debe estar entre ###ORIAL_NUTRITION### y ###END_ORIAL###
- date: fecha actual en formato YYYY-MM-DD
- totalCalories: calorías totales del día
- proteinG/carbsG/fatG: gramos totales de cada macronutriente
- sodiumMg: miligramos totales de sodio (CRÍTICO para cálculo de hidratación)
- fiberG: gramos de fibra (opcional)
- meals: array con cada comida del día
    `.trim();
}

export const nutritionService = {
  importFromOpenclaw,
  logMeal,
  getTodayNutrition,
  getHistory,
  parseOpenclawMessage,
  processOpenclawMessage,
  formatForAgent,
};
