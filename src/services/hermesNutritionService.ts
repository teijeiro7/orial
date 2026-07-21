import { getHermesConfig } from './openclawService';
import { nutritionService, type OpenclawNutritionData, type UpsertResult } from './nutritionService';
import { todayDateString, dateString } from '../utils/date';
import { subDays } from 'date-fns';

/**
 * Raw shape returned by the Hermes `/nutrition/v1/nutrition/*` endpoints.
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

const TIMEOUT_MS = 5_000;

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

async function fetchJson<T>(url: string, apiKey: string): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(id);
  }
}

function mapResult(r: UpsertResult, date: string): SyncResult {
  return { written: r.written, reason: r.reason, date };
}

async function syncOne(
  date: string,
  fetcher: (apiUrl: string, apiKey: string) => Promise<HermesNutritionDay>,
  force: boolean,
): Promise<SyncResult> {
  const config = await getHermesConfig();
  if (!config) return { written: false, reason: 'not-configured', date };
  try {
    const raw = await fetcher(config.apiUrl, config.apiKey);
    const data = toInternalData(raw);
    const result = await nutritionService.upsertDailyTotals('hermes', data, JSON.stringify(raw), force);
    return mapResult(result, data.date);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { written: false, reason: 'error', error: 'Request timed out', date };
    }
    return { written: false, reason: 'error', error: String(e), date };
  }
}

async function syncMany(
  fetcher: (apiUrl: string, apiKey: string) => Promise<HermesNutritionDay[]>,
  force: boolean,
): Promise<SyncResult[]> {
  const config = await getHermesConfig();
  if (!config) return [];
  try {
    const days = await fetcher(config.apiUrl, config.apiKey);
    const results: SyncResult[] = [];
    for (const day of days) {
      const data = toInternalData(day);
      const result = await nutritionService.upsertDailyTotals('hermes', data, JSON.stringify(day), force);
      results.push(mapResult(result, data.date));
    }
    return results;
  } catch (e) {
    const msg = e instanceof DOMException && e.name === 'AbortError' ? 'Request timed out' : String(e);
    return [{ written: false, reason: 'error', error: msg, date: 'range' }];
  }
}

export const hermesNutritionService = {
  async syncToday(force = false): Promise<SyncResult> {
    return syncOne(
      todayDateString(),
      async (apiUrl, apiKey) => fetchJson<HermesNutritionDay>(`${apiUrl}/nutrition/v1/nutrition/today`, apiKey),
      force,
    );
  },

  async syncDate(date: string, force = false): Promise<SyncResult> {
    return syncOne(
      date,
      async (apiUrl, apiKey) => fetchJson<HermesNutritionDay>(`${apiUrl}/nutrition/v1/nutrition/${date}`, apiKey),
      force,
    );
  },

  async syncRange(from: string, to: string, force = false): Promise<SyncResult[]> {
    return syncMany(
      async (apiUrl, apiKey) =>
        fetchJson<HermesNutritionDay[]>(`${apiUrl}/nutrition/v1/nutrition/range?from=${from}&to=${to}`, apiKey),
      force,
    );
  },

  async syncLast14Days(force = false): Promise<SyncResult[]> {
    const to = todayDateString();
    const from = dateString(subDays(new Date(), 13));
    return hermesNutritionService.syncRange(from, to, force);
  },

  async checkHealth(): Promise<boolean> {
    const config = await getHermesConfig();
    if (!config) return false;
    try {
      await fetchJson(`${config.apiUrl}/nutrition/health`, config.apiKey);
      return true;
    } catch {
      return false;
    }
  },
};
