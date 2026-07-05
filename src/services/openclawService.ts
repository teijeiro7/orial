import * as SecureStore from 'expo-secure-store';
import type { InboxItem, HermesType } from './hermesDispatchers';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AgentConfig {
  apiUrl: string;
  apiKey: string;
}

/**
 * @deprecated kept for back-compat with the legacy workout server URL slot.
 * The Hermes server now serves a generic typed inbox at `{url}/inbox/pending`
 * and the URL is stored under `hermes_server_url` via the generic methods below.
 */
export interface PendingWorkout {
  id: string;
  payload: WorkoutPayload;
  createdAt: string;
}

export interface WorkoutPayload {
  routineName: string;
  date: string;
  durationMin?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  strainScore?: number;
  kilojoule?: number;
  zones?: { z1: number; z2: number; z3: number; z4: number; z5: number };
  exercises: Array<{
    name: string;
    sets: Array<{ reps: number; weightKg: number }>;
  }>;
}

const HERMES_STORAGE_URL = 'hermes_api_url';
const HERMES_STORAGE_KEY = 'hermes_api_key';
const LEGACY_OPENCLAW_URL = 'openclaw_api_url';
const LEGACY_OPENCLAW_KEY = 'openclaw_api_key';
const WORKOUT_SERVER_URL = 'hermes_workout_url';
const HERMES_SERVER_URL = 'hermes_server_url';

class AgentService {
  private static instance: AgentService;

  static getInstance(): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService();
    }
    return AgentService.instance;
  }

  // ── Chat config (legacy Hermes chat endpoint) ───────────────────────────

  async getConfig(): Promise<AgentConfig | null> {
    try {
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

  async chat(messages: ChatMessage[], onChunk?: (text: string) => void): Promise<string> {
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
      const raw = await response.text();
      return this.parseSSE(raw, onChunk);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  // ── Generic Hermes server (typed inbox) ────────────────────────────────

  /**
   * Returns the configured Hermes server base URL, preferring the new
   * `hermes_server_url` slot and falling back to the legacy workout server
   * slot so users upgrading from a previous version keep working.
   */
  async getHermesServerUrl(): Promise<string | null> {
    let stored = await SecureStore.getItemAsync(HERMES_SERVER_URL);
    if (!stored) stored = await SecureStore.getItemAsync(WORKOUT_SERVER_URL);
    return stored ? stored.replace(/\/$/, '') : null;
  }

  async saveHermesServerUrl(url: string): Promise<void> {
    const normalized = url.replace(/\/$/, '');
    await SecureStore.setItemAsync(HERMES_SERVER_URL, normalized);
    // Mirror into the legacy slot so old call sites still resolve during the
    // transition. The old slot is only ever read from now.
    await SecureStore.setItemAsync(WORKOUT_SERVER_URL, normalized);
  }

  async clearHermesServerUrl(): Promise<void> {
    await SecureStore.deleteItemAsync(HERMES_SERVER_URL);
    await SecureStore.deleteItemAsync(WORKOUT_SERVER_URL);
  }

  async isHermesServerConfigured(): Promise<boolean> {
    const url = await this.getHermesServerUrl();
    return url !== null;
  }

  async checkHermesServerHealth(): Promise<boolean> {
    const url = await this.getHermesServerUrl();
    if (!url) return false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${url}/inbox/pending`, { signal: controller.signal });
      clearTimeout(timeoutId);
      // 200 OK or 204 No Content both mean the server is reachable. Auth failures
      // would surface as 401/403 and we want the user to see those distinctly.
      return res.ok || res.status === 204;
    } catch {
      return false;
    }
  }

  /**
   * Pull all pending typed items from the Hermes server inbox.
   * Server contract: GET {url}/inbox/pending → 200 [{ id, type, payload, createdAt }]
   * `payload` is the per-type `data` field of the HermesPayload union.
   */
  async fetchPendingInbox(): Promise<InboxItem[]> {
    const url = await this.getHermesServerUrl();
    if (!url) throw new Error('Hermes server not configured');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(`${url}/inbox/pending`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.status === 204) return [];
      if (!res.ok) throw new Error(`Hermes server returned ${res.status}`);
      const raw = (await res.json()) as Array<{
        id: string;
        type: HermesType;
        payload: unknown;
        createdAt: string;
      }>;
      return raw.map((r) => ({
        id: r.id,
        type: r.type,
        payload: r.payload,
        createdAt: r.createdAt,
      }));
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  }

  /**
   * Acknowledge (delete) a single inbox item on the Hermes server so it won't
   * be re-delivered on the next poll. Safe to call even if the item has
   * already been consumed server-side.
   */
  async ackInboxItem(externalId: string): Promise<void> {
    const url = await this.getHermesServerUrl();
    if (!url) return;
    try {
      await fetch(`${url}/inbox/${encodeURIComponent(externalId)}`, { method: 'DELETE' });
    } catch {
      // best-effort: server may have already GC'd the item
    }
  }

  // ── Legacy workout-only API (deprecated) ────────────────────────────────

  /** @deprecated use getHermesServerUrl */
  async getWorkoutServerUrl(): Promise<string | null> {
    return this.getHermesServerUrl();
  }

  /** @deprecated use saveHermesServerUrl */
  async saveWorkoutServerUrl(url: string): Promise<void> {
    return this.saveHermesServerUrl(url);
  }

  /** @deprecated use clearHermesServerUrl */
  async clearWorkoutServerUrl(): Promise<void> {
    return this.clearHermesServerUrl();
  }

  /** @deprecated use isHermesServerConfigured */
  async isWorkoutServerConfigured(): Promise<boolean> {
    return this.isHermesServerConfigured();
  }

  /**
   * @deprecated use the generic inbox via hermesInboxService. Kept as a
   * convenience wrapper that filters the inbox to workout items so the
   * existing gym.tsx call site keeps working until fully migrated.
   */
  async fetchPendingWorkouts(): Promise<PendingWorkout[]> {
    const items = await this.fetchPendingInbox();
    return items
      .filter((i) => i.type === 'workout')
      .map((i) => ({
        id: i.id,
        payload: i.payload as WorkoutPayload,
        createdAt: i.createdAt,
      }));
  }

  /** @deprecated use ackInboxItem */
  async consumeWorkout(id: string): Promise<void> {
    return this.ackInboxItem(id);
  }

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
