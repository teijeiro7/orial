import * as SecureStore from 'expo-secure-store';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OpenClawConfig {
  apiUrl: string;
  apiKey: string;
}

class OpenClawService {
  private static instance: OpenClawService;

  static getInstance(): OpenClawService {
    if (!OpenClawService.instance) {
      OpenClawService.instance = new OpenClawService();
    }
    return OpenClawService.instance;
  }

  async getConfig(): Promise<OpenClawConfig | null> {
    try {
      const apiUrl = await SecureStore.getItemAsync('openclaw_api_url');
      const apiKey = await SecureStore.getItemAsync('openclaw_api_key');
      if (!apiUrl) return null;
      return { apiUrl: apiUrl.replace(/\/$/, ''), apiKey: apiKey || '' };
    } catch {
      return null;
    }
  }

  async isConfigured(): Promise<boolean> {
    const config = await this.getConfig();
    return config !== null;
  }

  async checkHealth(): Promise<boolean> {
    const config = await this.getConfig();
    if (!config) return false;
    try {
      const response = await fetch(`${config.apiUrl}/health`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${config.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
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
    if (!config) throw new Error('OpenClaw not configured');

    const response = await fetch(`${config.apiUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: 'jarvis',
        messages,
        stream: !!onChunk,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenClaw error ${response.status}: ${error}`);
    }

    if (onChunk && response.body) {
      return this.readStream(response, onChunk);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  private async readStream(
    response: Response,
    onChunk: (text: string) => void
  ): Promise<string> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let full = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            onChunk(delta);
          }
        } catch {
          // malformed chunk — skip
        }
      }
    }

    return full;
  }
}

export const openClawService = OpenClawService.getInstance();
