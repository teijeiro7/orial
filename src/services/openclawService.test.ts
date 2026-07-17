import * as SecureStore from 'expo-secure-store';
import { agentService, parseOCRResult, type OCRResult } from './openclawService';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockedGetItemAsync = SecureStore.getItemAsync as jest.Mock;

/** Sample payload matching the Jarvis vision contract documented in openclawService.ts. */
function validPayload() {
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
  };
}

describe('parseOCRResult', () => {
  it('parses a well-formed Jarvis vision payload into an OCRResult', () => {
    const result = parseOCRResult(validPayload());

    expect(result.foods).toHaveLength(3);
    expect(result.foods[0]).toEqual({
      name: 'Arroz blanco',
      estimatedGrams: 200,
      calories: 260,
      protein: 6,
      carbs: 58,
      fat: 0.4,
    });
    expect(result.totalCalories).toBe(541);
    expect(result.totalProteinG).toBe(54.8);
    expect(result.totalCarbsG).toBe(65);
    expect(result.totalFatG).toBe(6.1);
    expect(result.confidence).toBe('high');
    expect(result.disclaimer).toContain('±20%');
  });

  it('throws when the response is not an object', () => {
    expect(() => parseOCRResult(null)).toThrow('Jarvis OCR response is not an object');
    expect(() => parseOCRResult('nope')).toThrow('Jarvis OCR response is not an object');
  });

  it('throws when "foods" is missing or not an array', () => {
    const payload = validPayload();
    // @ts-expect-error intentionally malformed for the test
    delete payload.foods;
    expect(() => parseOCRResult(payload)).toThrow('"foods" must be an array');
  });

  it('throws when a food item is missing a required numeric field', () => {
    const payload = validPayload();
    // @ts-expect-error intentionally malformed for the test
    delete payload.foods[0].calories;
    expect(() => parseOCRResult(payload)).toThrow('foods[0].calories is not a finite number');
  });

  it('throws when a food item has no name', () => {
    const payload = validPayload();
    payload.foods[1].name = '';
    expect(() => parseOCRResult(payload)).toThrow('foods[1].name is missing');
  });

  it('throws when a top-level total is missing', () => {
    const payload = validPayload();
    // @ts-expect-error intentionally malformed for the test
    delete payload.totalCalories;
    expect(() => parseOCRResult(payload)).toThrow('"totalCalories" is not a finite number');
  });

  it('throws when confidence is not one of the allowed values', () => {
    const payload = { ...validPayload(), confidence: 'super-sure' };
    expect(() => parseOCRResult(payload)).toThrow('"confidence" must be "high" | "medium" | "low"');
  });

  it('throws when disclaimer is missing', () => {
    const payload = validPayload();
    // @ts-expect-error intentionally malformed for the test
    delete payload.disclaimer;
    expect(() => parseOCRResult(payload)).toThrow('"disclaimer" must be a string');
  });
});

describe('agentService.sendImageForAnalysis', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockedGetItemAsync.mockReset();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws when Hermes/Jarvis is not configured', async () => {
    mockedGetItemAsync.mockResolvedValue(null);
    await expect(agentService.sendImageForAnalysis('file:///meal.jpg')).rejects.toThrow(
      'Hermes Agent not configured',
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('uploads the photo as multipart form-data and returns the parsed OCRResult', async () => {
    mockedGetItemAsync.mockImplementation(async (key: string) => {
      if (key === 'hermes_api_url') return 'https://hermes.example.com';
      if (key === 'hermes_api_key') return 'secret-key';
      return null;
    });
    const responseBody: OCRResult = validPayload() as OCRResult;
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => responseBody,
      text: async () => '',
    });

    const result = await agentService.sendImageForAnalysis('file:///meal.jpg');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://hermes.example.com/v1/vision/meal');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer secret-key');
    expect(options.body).toBeInstanceOf(FormData);
    expect(result.totalCalories).toBe(541);
    expect(result.foods).toHaveLength(3);
  });

  it('throws a descriptive error when Jarvis responds with a non-OK status', async () => {
    mockedGetItemAsync.mockImplementation(async (key: string) => {
      if (key === 'hermes_api_url') return 'https://hermes.example.com';
      if (key === 'hermes_api_key') return 'secret-key';
      return null;
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => 'bad gateway',
    });

    await expect(agentService.sendImageForAnalysis('file:///meal.jpg')).rejects.toThrow(
      'Hermes vision error 502: bad gateway',
    );
  });

  it('rejects when Jarvis responds with a payload that fails the OCR contract', async () => {
    mockedGetItemAsync.mockImplementation(async (key: string) => {
      if (key === 'hermes_api_url') return 'https://hermes.example.com';
      if (key === 'hermes_api_key') return 'secret-key';
      return null;
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ foods: [] }), // missing totals/confidence/disclaimer
      text: async () => '',
    });

    await expect(agentService.sendImageForAnalysis('file:///meal.jpg')).rejects.toThrow(
      'is not a finite number',
    );
  });
});
