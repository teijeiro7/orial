import { db } from './database';
import { nutritionService } from './nutritionService';
import type { OCRResult } from './openclawService';

jest.mock('./database', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  },
}));

const mockedDb = db as unknown as {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
};

/** Sample OCR result matching the Jarvis vision contract (see openclawService.ts). */
function sampleOCRResult(overrides: Partial<OCRResult> = {}): OCRResult {
  return {
    foods: [
      { name: 'Arroz blanco', estimatedGrams: 200, calories: 260, protein: 6, carbs: 58, fat: 0.4 },
      { name: 'Pechuga de pollo', estimatedGrams: 150, calories: 247, protein: 46, carbs: 0, fat: 5.3 },
      { name: 'Brócoli', estimatedGrams: 100, calories: 34, protein: 2.8, carbs: 7, fat: 0.4 },
    ],
    totalCalories: 541,
    totalProteinG: 54.8,
    totalCarbsG: 65,
    totalFatG: 6.1,
    confidence: 'high',
    disclaimer: 'Estimación visual ±20%. Ajusta cantidades si tienes los datos exactos.',
    ...overrides,
  };
}

/** Wires `db.select().from().where().limit()` to resolve to `rows`. */
function mockSelectResult(rows: unknown[]) {
  const limit = jest.fn().mockResolvedValue(rows);
  const where = jest.fn(() => ({ limit }));
  const from = jest.fn(() => ({ where }));
  mockedDb.select.mockReturnValue({ from });
  return { from, where, limit };
}

/** Wires `db.insert().values()` to resolve successfully and capture the payload. */
function mockInsert() {
  const values = jest.fn().mockResolvedValue(undefined);
  mockedDb.insert.mockReturnValue({ values });
  return values;
}

/** Wires `db.update().set().where()` to resolve successfully and capture the payload. */
function mockUpdate() {
  const where = jest.fn().mockResolvedValue(undefined);
  const set = jest.fn(() => ({ where }));
  mockedDb.update.mockReturnValue({ set });
  return { set, where };
}

describe('nutritionService.logMeal', () => {
  beforeEach(() => {
    mockedDb.select.mockReset();
    mockedDb.insert.mockReset();
    mockedDb.update.mockReset();
  });

  it('creates a new nutrition_logs row (source: ocr) when nothing was logged yet for the date', async () => {
    mockSelectResult([]);
    const values = mockInsert();

    await nutritionService.logMeal(sampleOCRResult(), '2026-07-11');

    expect(mockedDb.insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-07-11',
        source: 'ocr',
        totalCalories: 541,
        proteinG: 54.8,
        carbsG: 65,
        fatG: 6.1,
        sodiumMg: 0,
        fiberG: 0,
      }),
    );
    const inserted = values.mock.calls[0][0];
    expect(typeof inserted.id).toBe('string');
    expect(inserted.id.length).toBeGreaterThan(0);
    expect(mockedDb.update).not.toHaveBeenCalled();
  });

  it('adds the meal macros onto an existing day total instead of overwriting it', async () => {
    mockSelectResult([
      {
        id: 'existing-id',
        date: '2026-07-11',
        source: 'openclaw',
        totalCalories: 300,
        proteinG: 20,
        carbsG: 30,
        fatG: 10,
        sodiumMg: 500,
        fiberG: 4,
      },
    ]);
    const { set, where } = mockUpdate();

    await nutritionService.logMeal(sampleOCRResult(), '2026-07-11');

    expect(mockedDb.update).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        totalCalories: 841, // 300 + 541
        proteinG: 74.8, // 20 + 54.8
        carbsG: 95, // 30 + 65
        fatG: 16.1, // 10 + 6.1
      }),
    );
    expect(where).toHaveBeenCalled();
    expect(mockedDb.insert).not.toHaveBeenCalled();
  });

  it('defaults to today when no date is passed', async () => {
    mockSelectResult([]);
    const values = mockInsert();

    await nutritionService.logMeal(sampleOCRResult());

    const today = new Date().toISOString().split('T')[0];
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ date: today }));
  });

  it('persists the raw OCR payload for traceability', async () => {
    mockSelectResult([]);
    const values = mockInsert();
    const result = sampleOCRResult();

    await nutritionService.logMeal(result, '2026-07-11');

    const inserted = values.mock.calls[0][0];
    expect(JSON.parse(inserted.rawData)).toEqual(result);
  });
});
