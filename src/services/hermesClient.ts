import type { AgentConfig } from './openclawService';

export const HERMES_TIMEOUT_MS = 5_000;

/** GET `${config.apiUrl}${path}` with the stored Bearer token, aborting after HERMES_TIMEOUT_MS. */
export async function fetchHermes<T>(path: string, config: AgentConfig): Promise<T> {
  const url = `${config.apiUrl}${path}`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), HERMES_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
    return (await res.json()) as T;
  } catch (e) {
    console.warn(`[hermesClient] request failed: ${url}`, e);
    throw e;
  } finally {
    clearTimeout(id);
  }
}

/** Maps a fetchHermes rejection to a user-facing message, normalizing the abort-timeout case. */
export function toHermesError(e: unknown): string {
  if (e instanceof DOMException && e.name === 'AbortError') return 'Request timed out';
  return String(e);
}
