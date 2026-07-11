import * as SecureStore from 'expo-secure-store';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AgentConfig {
  apiUrl: string;
  apiKey: string;
}

/**
 * Jarvis vision (OCR) contract — T5 "OCR Alimentación".
 *
 * The app sends a meal photo to Jarvis (`POST {apiUrl}/v1/vision/meal`, see
 * `sendImageForAnalysis` below); Jarvis's vision model (Claude/GPT-4V — server
 * side, out of scope for this repo) identifies the foods on the plate and
 * estimates macros, then responds with this exact JSON shape:
 *
 * ```json
 * {
 *   "foods": [
 *     { "name": "Arroz blanco", "estimatedGrams": 200, "calories": 260, "protein": 6, "carbs": 58, "fat": 0.4 },
 *     { "name": "Pechuga de pollo", "estimatedGrams": 150, "calories": 247, "protein": 46, "carbs": 0, "fat": 5.3 },
 *     { "name": "Brócoli", "estimatedGrams": 100, "calories": 34, "protein": 2.8, "carbs": 7, "fat": 0.4 }
 *   ],
 *   "totalCalories": 541,
 *   "totalProteinG": 54.8,
 *   "totalCarbsG": 65,
 *   "totalFatG": 6.1,
 *   "confidence": "high",
 *   "disclaimer": "Estimación visual ±20%. Ajusta cantidades si tienes los datos exactos."
 * }
 * ```
 */
export interface OCRFoodItem {
  name: string;
  estimatedGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type OCRConfidence = 'high' | 'medium' | 'low';

export interface OCRResult {
  foods: OCRFoodItem[];
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  confidence: OCRConfidence;
  disclaimer: string;
}

const HERMES_STORAGE_URL = 'hermes_api_url';
const HERMES_STORAGE_KEY = 'hermes_api_key';
const LEGACY_OPENCLAW_URL = 'openclaw_api_url';
const LEGACY_OPENCLAW_KEY = 'openclaw_api_key';

class AgentService {
  private static instance: AgentService;

  static getInstance(): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService();
    }
    return AgentService.instance;
  }

  async getConfig(): Promise<AgentConfig | null> {
    try {
      // Try new Hermes keys first, fall back to legacy OpenClaw keys
      let apiUrl = await SecureStore.getItemAsync(HERMES_STORAGE_URL);
      let apiKey = await SecureStore.getItemAsync(HERMES_STORAGE_KEY);

      if (!apiUrl) {
        apiUrl = await SecureStore.getItemAsync(LEGACY_OPENCLAW_URL);
        apiKey = await SecureStore.getItemAsync(LEGACY_OPENCLAW_KEY);
      }

      if (!apiUrl) return null;
      return { apiUrl: apiUrl.replace(/\/$/, ''), apiKey: apiKey || '' };
    } catch {
      return null;
    }
  }

  async saveConfig(apiUrl: string, apiKey: string): Promise<void> {
    await SecureStore.setItemAsync(HERMES_STORAGE_URL, apiUrl);
    await SecureStore.setItemAsync(HERMES_STORAGE_KEY, apiKey);
  }

  async clearConfig(): Promise<void> {
    await SecureStore.deleteItemAsync(HERMES_STORAGE_URL);
    await SecureStore.deleteItemAsync(HERMES_STORAGE_KEY);
  }

  async isConfigured(): Promise<boolean> {
    const config = await this.getConfig();
    return config !== null;
  }

  async checkHealth(): Promise<boolean> {
    const config = await this.getConfig();
    if (!config) return false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${config.apiUrl}/health`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${config.apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  async chat(
    messages: ChatMessage[],
    onChunk?: (text: string) => void
  ): Promise<string> {
    const config = await this.getConfig();
    if (!config) throw new Error('Hermes Agent not configured');

    const response = await fetch(`${config.apiUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: 'hermes-agent',
        messages,
        stream: !!onChunk,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Hermes error ${response.status}: ${error}`);
    }

    if (onChunk) {
      // React Native (Hermes) doesn't support ReadableStream (response.body).
      // Read full text and parse SSE manually.
      const raw = await response.text();
      return this.parseSSE(raw, onChunk);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  /**
   * Sends a meal photo to Jarvis for vision-based food/macro analysis and
   * returns the parsed, validated `OCRResult`.
   *
   * `imageUri` is a local file URI (e.g. from `expo-camera`'s `takePictureAsync`).
   * The photo is uploaded as multipart/form-data — no `Content-Type` header is
   * set explicitly so `fetch` can attach the correct multipart boundary.
   */
  async sendImageForAnalysis(imageUri: string): Promise<OCRResult> {
    const config = await this.getConfig();
    if (!config) throw new Error('Hermes Agent not configured');

    const form = new FormData();
    const filename = imageUri.split('/').pop() || 'meal.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const ext = match ? match[1].toLowerCase() : 'jpg';
    // React Native's FormData accepts this { uri, name, type } shape in place
    // of a real Blob/File.
    form.append('image', {
      uri: imageUri,
      name: filename,
      type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    } as unknown as Blob);

    const response = await fetch(`${config.apiUrl}/v1/vision/meal`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: form,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Hermes vision error ${response.status}: ${error}`);
    }

    const data = await response.json();
    return parseOCRResult(data);
  }

  /** Parse SSE text and call onChunk for each delta. Works without ReadableStream. */
  private parseSSE(raw: string, onChunk: (text: string) => void): string {
    let full = '';
    for (const line of raw.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') break;
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onChunk(delta);
        }
      } catch {
        // skip malformed line
      }
    }
    return full;
  }
}

export const agentService = AgentService.getInstance();

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseOCRFoodItem(value: unknown, index: number): OCRFoodItem {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`Jarvis OCR response: foods[${index}] is not an object`);
  }
  const item = value as Record<string, unknown>;
  if (typeof item.name !== 'string' || !item.name) {
    throw new Error(`Jarvis OCR response: foods[${index}].name is missing`);
  }
  const numericFields: Array<keyof OCRFoodItem> = ['estimatedGrams', 'calories', 'protein', 'carbs', 'fat'];
  for (const field of numericFields) {
    if (!isFiniteNumber(item[field])) {
      throw new Error(`Jarvis OCR response: foods[${index}].${field} is not a finite number`);
    }
  }
  return {
    name: item.name,
    estimatedGrams: item.estimatedGrams as number,
    calories: item.calories as number,
    protein: item.protein as number,
    carbs: item.carbs as number,
    fat: item.fat as number,
  };
}

/**
 * Validates and normalizes Jarvis's vision-analysis JSON payload into an
 * `OCRResult`. Throws a descriptive error on any missing/malformed field so
 * callers never persist half-parsed data. Exported standalone (rather than
 * only reachable via `sendImageForAnalysis`'s network call) so the contract
 * can be unit tested directly against fixture JSON.
 */
export function parseOCRResult(data: unknown): OCRResult {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Jarvis OCR response is not an object');
  }
  const payload = data as Record<string, unknown>;

  if (!Array.isArray(payload.foods)) {
    throw new Error('Jarvis OCR response: "foods" must be an array');
  }
  const foods = payload.foods.map((food, index) => parseOCRFoodItem(food, index));

  const totalFields: Array<keyof Pick<OCRResult, 'totalCalories' | 'totalProteinG' | 'totalCarbsG' | 'totalFatG'>> = [
    'totalCalories',
    'totalProteinG',
    'totalCarbsG',
    'totalFatG',
  ];
  for (const field of totalFields) {
    if (!isFiniteNumber(payload[field])) {
      throw new Error(`Jarvis OCR response: "${field}" is not a finite number`);
    }
  }

  const confidence = payload.confidence;
  if (confidence !== 'high' && confidence !== 'medium' && confidence !== 'low') {
    throw new Error('Jarvis OCR response: "confidence" must be "high" | "medium" | "low"');
  }

  if (typeof payload.disclaimer !== 'string') {
    throw new Error('Jarvis OCR response: "disclaimer" must be a string');
  }

  return {
    foods,
    totalCalories: payload.totalCalories as number,
    totalProteinG: payload.totalProteinG as number,
    totalCarbsG: payload.totalCarbsG as number,
    totalFatG: payload.totalFatG as number,
    confidence,
    disclaimer: payload.disclaimer,
  };
}
