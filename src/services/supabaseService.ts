import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Thin wrapper around the Supabase JS client.
 *
 * Credentials come from Expo public env vars (must be prefixed `EXPO_PUBLIC_`
 * so they are inlined into the app bundle and reachable via `process.env`):
 *   - EXPO_PUBLIC_SUPABASE_URL
 *   - EXPO_PUBLIC_SUPABASE_ANON_KEY   (anon key is public-safe by design)
 *
 * When credentials are missing or still placeholders, the service degrades
 * gracefully: `getClient()` returns a client built with a harmless fallback
 * URL/key so the app never crashes at startup, and `isConfigured()` returns
 * false so callers (e.g. the sync service) can skip remote work while offline.
 */

// Fallback values keep `createClient` from throwing when real creds are absent.
const FALLBACK_URL = 'https://placeholder.supabase.co';
const FALLBACK_ANON_KEY = 'placeholder-anon-key';

const PLACEHOLDER_HINTS = ['xxxx', 'your_', 'placeholder', 'eyJxxx'];

function readEnv(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function looksLikePlaceholder(value: string): boolean {
  if (!value) return true;
  const lower = value.toLowerCase();
  return PLACEHOLDER_HINTS.some((hint) => lower.includes(hint));
}

export class SupabaseService {
  private client: SupabaseClient | null = null;
  private configured = false;

  /** Returns the cached Supabase client, creating it on first use. */
  getClient(): SupabaseClient {
    if (this.client) return this.client;

    const url = readEnv('EXPO_PUBLIC_SUPABASE_URL');
    const anonKey = readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');
    this.configured = !looksLikePlaceholder(url) && !looksLikePlaceholder(anonKey);

    this.client = createClient(url || FALLBACK_URL, anonKey || FALLBACK_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    return this.client;
  }

  /** True only when real (non-placeholder) credentials are present. */
  isConfigured(): boolean {
    if (!this.client) this.getClient();
    return this.configured;
  }

  /** Selects rows from `table`, applying each entry of `filters` as an eq match. */
  async query<T = Record<string, unknown>>(
    table: string,
    filters: Record<string, unknown> = {},
  ): Promise<T[]> {
    let builder = this.getClient().from(table).select('*');
    for (const [column, value] of Object.entries(filters)) {
      builder = builder.eq(column, value);
    }
    const { data, error } = await builder;
    if (error) throw new Error(error.message);
    return (data ?? []) as T[];
  }

  /** Inserts a single row and returns the created record. */
  async insert<T = Record<string, unknown>>(table: string, data: Record<string, unknown>): Promise<T> {
    const { data: row, error } = await this.getClient().from(table).insert(data).select().single();
    if (error) throw new Error(error.message);
    return row as T;
  }

  /** Updates the row identified by `id` and returns the updated record. */
  async update<T = Record<string, unknown>>(
    table: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<T> {
    const { data: row, error } = await this.getClient()
      .from(table)
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as T;
  }

  /** Upserts a row, resolving conflicts on `conflictKey` (defaults to `id`). */
  async upsert<T = Record<string, unknown>>(
    table: string,
    data: Record<string, unknown>,
    conflictKey = 'id',
  ): Promise<T> {
    const { data: row, error } = await this.getClient()
      .from(table)
      .upsert(data, { onConflict: conflictKey })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as T;
  }

  /** Uploads a file to a storage bucket and returns its public URL. */
  async uploadFile(
    bucket: string,
    path: string,
    file: Blob | ArrayBuffer | Uint8Array,
  ): Promise<string> {
    const { error } = await this.getClient().storage.from(bucket).upload(path, file, {
      upsert: true,
    });
    if (error) throw new Error(error.message);
    return this.getPublicUrl(bucket, path);
  }

  /** Returns the public URL for an object in a storage bucket. */
  getPublicUrl(bucket: string, path: string): string {
    return this.getClient().storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  /** Test hook: drops the cached client so env changes take effect. */
  resetClient(): void {
    this.client = null;
    this.configured = false;
  }
}

export const supabaseService = new SupabaseService();
