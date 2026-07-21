import { db } from './database';
import { nutritionLogs, manualMetrics, type NutritionLog, type NewNutritionLog } from '../../drizzle/schema';
import { eq, desc, gte } from 'drizzle-orm';
import { generateUUID } from '../utils/uuid';
import { manualMetricsService } from './manualMetricsService';
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

export type UpsertSource = 'hermes' | 'openclaw';

export interface UpsertResult {
  written: boolean;
  reason: 'inserted' | 'updated' | 'skipped-exists';
}

/**
 * Writes a daily nutrition summary to the local database.
 *
 * If a row already exists for `data.date` and `force` is false, the function
 * returns `{ written: false, reason: 'skipped-exists' }` without touching the
 * database. When `force` is true the existing row is replaced.
 *
 * On successful write the function also syncs manual metrics (for the dashboard
 * calorie counter).  The sodium-intake / hydration side-effects that the
 * original `importFromOpenclaw` had are intentionally omitted here — Hermes
 * does not provide per-meal sodium, so those writes would always be zeros.
 *
 * @param source  Where the data came from ('hermes' for HTTP sync, 'openclaw' for chat).
 * @param data    The nutrition summary.
 * @param raw     Optional raw JSON string to persist in `rawData` (auditing).
 * @param force   When false, existing rows are never overwritten.
 */
async function upsertDailyTotals(
  source: UpsertSource,
  data: OpenclawNutritionData,
  raw?: string,
  force = false,
): Promise<UpsertResult> {
  const existingRows = await db.select().from(nutritionLogs).where(eq(nutritionLogs.date, data.date)).limit(1);
  const existing = existingRows[0];

  if (existing && !force) {
    return { written: false, reason: 'skipped-exists' };
  }

  const values: NewNutritionLog = {
    id: existing?.id ?? generateUUID(),
    date: data.date,
    source,
    totalCalories: data.totalCalories,
    proteinG: data.proteinG,
    carbsG: data.carbsG,
    fatG: data.fatG,
    sodiumMg: data.sodiumMg,
    fiberG: data.fiberG || 0,
    rawData: raw ?? JSON.stringify(data),
    createdAt: existing?.createdAt ?? new Date(),
  };

  if (existing) {
    await db.update(nutritionLogs).set(values).where(eq(nutritionLogs.id, existing.id));
  } else {
    await db.insert(nutritionLogs).values(values);
  }

  // Sync manual metrics so the dashboard calorie counter stays current
  // Only when we actually wrote (not on skip)
  await manualMetricsService.updateMetrics(data.date, {
    caloriesIn: data.totalCalories,
    proteinG: data.proteinG,
    carbsG: data.carbsG,
    fatG: data.fatG,
    sodiumMg: data.sodiumMg,
    fiberG: data.fiberG || 0,
  });

  return { written: true, reason: existing ? 'updated' : 'inserted' };
}

/**
 * Logs a single meal captured via Jarvis's OCR/vision analysis (T5).
 *
 * Unlike `upsertDailyTotals` (which replaces the whole day's totals with
 * a summary), a meal photo represents just ONE meal, so its macros are ADDED
 * to whatever is already logged for `date` (defaults to today) rather than
 * replacing it. If no row exists yet for that date, one is created with
 * `source: 'ocr'`.
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
    await upsertDailyTotals('openclaw', data);
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
  upsertDailyTotals,
  logMeal,
  getTodayNutrition,
  getHistory,
  parseOpenclawMessage,
  processOpenclawMessage,
  formatForAgent,
};
