import { getHermesConfig, type AgentConfig } from './openclawService';
import { nutritionService, type OpenclawNutritionData, type UpsertResult } from './nutritionService';
import { todayDateString, dateString } from '../utils/date';
import { subDays } from 'date-fns';
import { fetchHermes, toHermesError } from './hermesClient';

/** Base path for the Hermes nutrition backend (:8765), proxied at `/nutrition/v1/*`. */
const NUTRITION_BASE = '/nutrition/v1';

/**
 * Raw shape returned by the Hermes `/nutrition/v1/*` endpoints.
 * The field names differ from `OpenclawNutritionData` (top-level prefixes,
 * no sodium/fiber), so mapping is required before persisting.
 */
interface HermesNutritionMeal {
  time: string;
  meal_type: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface HermesNutritionDay {
  date: string;
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  meals?: HermesNutritionMeal[];
}

export interface SyncResult {
  written: boolean;
  reason: 'inserted' | 'updated' | 'skipped-exists' | 'error' | 'not-configured' | 'offline';
  error?: string;
  date: string;
}

function toInternalData(h: HermesNutritionDay): OpenclawNutritionData {
  return {
    date: h.date,
    totalCalories: h.totalCalories,
    proteinG: h.totalProteinG,
    carbsG: h.totalCarbsG,
    fatG: h.totalFatG,
    sodiumMg: 0,
    fiberG: 0,
  };
}

function mapResult(r: UpsertResult, date: string): SyncResult {
  return { written: r.written, reason: r.reason, date };
}

async function syncOne(
  date: string,
  fetcher: (config: AgentConfig) => Promise<HermesNutritionDay>,
  force: boolean,
): Promise<SyncResult> {
  const config = await getHermesConfig();
  if (!config) return { written: false, reason: 'not-configured', date };
  try {
    const raw = await fetcher(config);
    const data = toInternalData(raw);
    const result = await nutritionService.upsertDailyTotals('hermes', data, JSON.stringify(raw), force);
    return mapResult(result, data.date);
  } catch (e) {
    return { written: false, reason: 'error', error: toHermesError(e), date };
  }
}

async function syncMany(
  fetcher: (config: AgentConfig) => Promise<HermesNutritionDay[]>,
  force: boolean,
): Promise<SyncResult[]> {
  const config = await getHermesConfig();
  if (!config) return [];
  try {
    const days = await fetcher(config);
    const results: SyncResult[] = [];
    for (const day of days) {
      const data = toInternalData(day);
      const result = await nutritionService.upsertDailyTotals('hermes', data, JSON.stringify(day), force);
      results.push(mapResult(result, data.date));
    }
    return results;
  } catch (e) {
    return [{ written: false, reason: 'error', error: toHermesError(e), date: 'range' }];
  }
}

export const hermesNutritionService = {
  async syncToday(force = false): Promise<SyncResult> {
    return syncOne(
      todayDateString(),
      (config) => fetchHermes<HermesNutritionDay>(`${NUTRITION_BASE}/today`, config),
      force,
    );
  },

  async syncDate(date: string, force = false): Promise<SyncResult> {
    return syncOne(
      date,
      (config) => fetchHermes<HermesNutritionDay>(`${NUTRITION_BASE}/${date}`, config),
      force,
    );
  },

  async syncRange(from: string, to: string, force = false): Promise<SyncResult[]> {
    return syncMany(
      (config) => fetchHermes<HermesNutritionDay[]>(`${NUTRITION_BASE}/range?from=${from}&to=${to}`, config),
      force,
    );
  },

  async syncLast14Days(force = false): Promise<SyncResult[]> {
    const to = todayDateString();
    const from = dateString(subDays(new Date(), 13));
    return hermesNutritionService.syncRange(from, to, force);
  },

  /** Delegates to the gateway root `/health` — `/nutrition/health` is not a real route. */
  async checkHealth(): Promise<boolean> {
    const config = await getHermesConfig();
    if (!config) return false;
    try {
      await fetchHermes('/health', config);
      return true;
    } catch {
      return false;
    }
  },
};
