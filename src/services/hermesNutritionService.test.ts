import { hermesNutritionService } from './hermesNutritionService';
import { getHermesConfig } from './openclawService';
import { nutritionService } from './nutritionService';

jest.mock('./openclawService', () => ({
  getHermesConfig: jest.fn(),
}));

jest.mock('./nutritionService', () => ({
  nutritionService: {
    upsertDailyTotals: jest.fn(),
  },
}));

const mockedGetConfig = getHermesConfig as jest.MockedFunction<typeof getHermesConfig>;
const mockedUpsert = nutritionService.upsertDailyTotals as jest.MockedFunction<typeof nutritionService.upsertDailyTotals>;

function mockFetchJson(body: unknown, status = 200) {
  const json = jest.fn().mockResolvedValue(body);
  const res = { ok: status >= 200 && status < 300, status, json };
  global.fetch = jest.fn().mockResolvedValue(res) as never;
}

beforeEach(() => {
  jest.resetAllMocks();
  mockedGetConfig.mockResolvedValue({ apiUrl: 'https://hermes.test', apiKey: 'tok' });
  mockedUpsert.mockResolvedValue({ written: true, reason: 'inserted' });
});

afterEach(() => {
  delete (global as any).fetch;
});

describe('hermesNutritionService.syncToday', () => {
  it('calls /nutrition/v1/nutrition/today and persists via upsertDailyTotals', async () => {
    const day = { date: '2026-07-21', totalCalories: 743, totalProteinG: 59.6, totalCarbsG: 59.6, totalFatG: 28.6 };
    mockFetchJson(day);

    const result = await hermesNutritionService.syncToday();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://hermes.test/nutrition/v1/nutrition/today',
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } }),
    );
    expect(mockedUpsert).toHaveBeenCalledWith(
      'hermes',
      expect.objectContaining({ date: '2026-07-21', totalCalories: 743, proteinG: 59.6, carbsG: 59.6, fatG: 28.6, sodiumMg: 0, fiberG: 0 }),
      expect.any(String),
      false,
    );
    expect(result).toEqual({ written: true, reason: 'inserted', date: '2026-07-21' });
  });

  it('maps totalProteinG → proteinG, totalCarbsG → carbsG, totalFatG → fatG', async () => {
    mockFetchJson({ date: '2026-07-21', totalCalories: 100, totalProteinG: 10, totalCarbsG: 20, totalFatG: 5 });
    await hermesNutritionService.syncToday();

    const data = mockedUpsert.mock.calls[0][1];
    expect(data).toEqual(expect.objectContaining({ proteinG: 10, carbsG: 20, fatG: 5 }));
  });

  it('sodiumMg and fiberG are always 0 (Hermes does not return them)', async () => {
    mockFetchJson({ date: '2026-07-21', totalCalories: 100, totalProteinG: 10, totalCarbsG: 20, totalFatG: 5 });
    await hermesNutritionService.syncToday();

    const data = mockedUpsert.mock.calls[0][1];
    expect(data.sodiumMg).toBe(0);
    expect(data.fiberG).toBe(0);
  });

  it('stores original Hermes response in rawData (JSON string)', async () => {
    const day = { date: '2026-07-21', totalCalories: 100, totalProteinG: 10, totalCarbsG: 20, totalFatG: 5, meals: [{ time: '08:30', meal_type: 'desayuno', description: 'Eggs', calories: 100, protein: 10, carbs: 20, fat: 5 }] };
    mockFetchJson(day);
    await hermesNutritionService.syncToday();

    const raw = mockedUpsert.mock.calls[0][2];
    expect(JSON.parse(raw!)).toEqual(day);
  });

  it('returns not-configured when getHermesConfig returns null', async () => {
    mockedGetConfig.mockResolvedValue(null);

    const result = await hermesNutritionService.syncToday();
    expect(result).toEqual({ written: false, reason: 'not-configured', date: expect.any(String) });
    expect(global.fetch).toBeUndefined();
  });

  it('returns error on HTTP failure', async () => {
    mockFetchJson('Internal Server Error', 500);

    const result = await hermesNutritionService.syncToday();
    expect(result.reason).toBe('error');
    expect(result.written).toBe(false);
  });

  it('returns error on timeout', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    global.fetch = jest.fn().mockRejectedValue(abortError) as never;

    const result = await hermesNutritionService.syncToday();
    expect(result.reason).toBe('error');
    expect(result.error).toContain('timed out');
  });

  it('passes force parameter through to upsertDailyTotals', async () => {
    mockFetchJson({ date: '2026-07-21', totalCalories: 100, totalProteinG: 10, totalCarbsG: 20, totalFatG: 5 });
    await hermesNutritionService.syncToday(true);

    expect(mockedUpsert).toHaveBeenCalledWith(
      'hermes',
      expect.anything(),
      expect.any(String),
      true,
    );
  });
});

describe('hermesNutritionService.syncDate', () => {
  it('calls /nutrition/v1/nutrition/{date}', async () => {
    mockFetchJson({ date: '2026-07-20', totalCalories: 500, totalProteinG: 40, totalCarbsG: 50, totalFatG: 15 });
    await hermesNutritionService.syncDate('2026-07-20');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://hermes.test/nutrition/v1/nutrition/2026-07-20',
      expect.anything(),
    );
    expect(mockedUpsert).toHaveBeenCalledWith(
      'hermes',
      expect.objectContaining({ date: '2026-07-20' }),
      expect.any(String),
      false,
    );
  });
});

describe('hermesNutritionService.syncRange', () => {
  it('calls /nutrition/v1/nutrition/range and persists each day', async () => {
    const days = [
      { date: '2026-07-19', totalCalories: 200, totalProteinG: 15, totalCarbsG: 25, totalFatG: 8 },
      { date: '2026-07-20', totalCalories: 300, totalProteinG: 25, totalCarbsG: 35, totalFatG: 12 },
    ];
    mockFetchJson(days);

    const results = await hermesNutritionService.syncRange('2026-07-19', '2026-07-20');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://hermes.test/nutrition/v1/nutrition/range?from=2026-07-19&to=2026-07-20',
      expect.anything(),
    );
    expect(mockedUpsert).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(2);
    expect(results[0].date).toBe('2026-07-19');
    expect(results[1].date).toBe('2026-07-20');
  });

  it('returns empty array when not configured', async () => {
    mockedGetConfig.mockResolvedValue(null);
    const results = await hermesNutritionService.syncRange('2026-07-19', '2026-07-20');
    expect(results).toEqual([]);
  });

  it('returns error result on network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network')) as never;
    const results = await hermesNutritionService.syncRange('2026-07-19', '2026-07-20');
    expect(results).toHaveLength(1);
    expect(results[0].reason).toBe('error');
    expect(results[0].error).toContain('network');
  });
});

describe('hermesNutritionService.checkHealth', () => {
  it('returns true when /nutrition/health responds 200', async () => {
    mockFetchJson({ status: 'ok' });
    const ok = await hermesNutritionService.checkHealth();
    expect(ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://hermes.test/nutrition/health',
      expect.anything(),
    );
  });

  it('returns false when not configured', async () => {
    mockedGetConfig.mockResolvedValue(null);
    const ok = await hermesNutritionService.checkHealth();
    expect(ok).toBe(false);
  });

  it('returns false on error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('fail')) as never;
    const ok = await hermesNutritionService.checkHealth();
    expect(ok).toBe(false);
  });
});

describe('hermesNutritionService.syncLast14Days', () => {
  it('computes from/to dates and calls syncRange', async () => {
    mockFetchJson([]);
    await hermesNutritionService.syncLast14Days();

    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('/nutrition/v1/nutrition/range?from=');
    expect(url).toContain('&to=');
  });
});
