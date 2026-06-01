import * as SecureStore from 'expo-secure-store';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AgentConfig {
  apiUrl: string;
  apiKey: string;
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
