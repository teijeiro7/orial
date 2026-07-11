import AsyncStorage from '@react-native-async-storage/async-storage';
import { expoDb } from './database';
import { supabaseService } from './supabaseService';
import {
  SyncEngine,
  type CursorStore,
  type LocalStore,
  type SyncRemote,
  type SyncRow,
  type SyncTableConfig,
} from './syncEngine';

export type {
  SyncTableConfig,
  SyncRow,
  SyncResult,
  SyncStatus,
  SyncError,
} from './syncEngine';

/**
 * Tables replicated between local SQLite and Supabase.
 *
 * `timestampField` is the column used as the change cursor and must exist on
 * both sides. `conflictKey` is the primary key used for upserts. Tables without
 * a usable timestamp column (reminders, user_settings) and local-only tables
 * (sync_queue) are intentionally excluded.
 *
 * The Vitality tables (caffeine_logs, insight_logs) and the extra
 * gym_exercises columns are added to the Supabase migration by tasks T1/T2/T6;
 * they can be registered here in those branches once their local schema exists.
 */
export const DEFAULT_SYNC_TABLES: SyncTableConfig[] = [
  { table: 'habits', timestampField: 'created_at', conflictKey: 'id' },
  { table: 'habit_entries', timestampField: 'created_at', conflictKey: 'id' },
  { table: 'whoop_tokens', timestampField: 'created_at', conflictKey: 'id' },
  { table: 'whoop_daily', timestampField: 'updated_at', conflictKey: 'date' },
  { table: 'body_metrics', timestampField: 'created_at', conflictKey: 'id' },
  { table: 'pedometer_history', timestampField: 'updated_at', conflictKey: 'date' },
  { table: 'hydration', timestampField: 'updated_at', conflictKey: 'date' },
  { table: 'sodium_intake', timestampField: 'created_at', conflictKey: 'id' },
  { table: 'supplements', timestampField: 'created_at', conflictKey: 'id' },
  { table: 'supplement_logs', timestampField: 'created_at', conflictKey: 'id' },
  { table: 'manual_metrics', timestampField: 'updated_at', conflictKey: 'date' },
  { table: 'weight_predictions', timestampField: 'updated_at', conflictKey: 'date' },
  { table: 'nutrition_logs', timestampField: 'created_at', conflictKey: 'id' },
  { table: 'tasks', timestampField: 'created_at', conflictKey: 'id' },
  { table: 'gym_routines', timestampField: 'created_at', conflictKey: 'id' },
  { table: 'gym_exercises', timestampField: 'created_at', conflictKey: 'id' },
  { table: 'gym_sessions', timestampField: 'created_at', conflictKey: 'id' },
  { table: 'gym_sets', timestampField: 'created_at', conflictKey: 'id' },
  { table: 'finance_accounts', timestampField: 'updated_at', conflictKey: 'id' },
  { table: 'finance_subscriptions', timestampField: 'created_at', conflictKey: 'id' },
  { table: 'finance_orders', timestampField: 'created_at', conflictKey: 'id' },
  { table: 'finance_wishlist', timestampField: 'created_at', conflictKey: 'id' },
  { table: 'hydration_profile', timestampField: 'updated_at', conflictKey: 'id' },
];

/** Normalises a JS value to something SQLite accepts (booleans → 0/1). */
function toSqliteValue(value: unknown): string | number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'string') return value;
  return JSON.stringify(value);
}

/** Remote adapter backed by supabaseService + the raw client for range queries. */
export const supabaseRemote: SyncRemote = {
  async fetchChangedSince(config, since) {
    const { data, error } = await supabaseService
      .getClient()
      .from(config.table)
      .select('*')
      .gt(config.timestampField, since)
      .order(config.timestampField, { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as SyncRow[];
  },
  async upsert(config, row) {
    await supabaseService.upsert(config.table, row, config.conflictKey);
  },
};

/** Local adapter backed by the raw expo-sqlite database. */
export const sqliteLocalStore: LocalStore = {
  async getChangedSince(config, since) {
    const sql =
      `SELECT * FROM ${config.table} WHERE ${config.timestampField} > ? ` +
      `ORDER BY ${config.timestampField} ASC`;
    return (await expoDb.getAllAsync(sql, [since])) as SyncRow[];
  },
  async upsertIfNewer(config, row) {
    const key = row[config.conflictKey];
    const incomingTs = typeof row[config.timestampField] === 'number' ? (row[config.timestampField] as number) : 0;

    const existing = (await expoDb.getFirstAsync(
      `SELECT ${config.timestampField} AS ts FROM ${config.table} WHERE ${config.conflictKey} = ?`,
      [toSqliteValue(key)],
    )) as { ts: number } | null;

    // Last-write-wins: skip when the local copy is at least as new.
    if (existing && typeof existing.ts === 'number' && existing.ts >= incomingTs) {
      return false;
    }

    const columns = Object.keys(row);
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map((col) => toSqliteValue(row[col]));
    await expoDb.runAsync(
      `INSERT OR REPLACE INTO ${config.table} (${columns.join(', ')}) VALUES (${placeholders})`,
      values,
    );
    return true;
  },
};

/** Cursor storage backed by AsyncStorage. */
export const asyncStorageCursors: CursorStore = {
  async get(key) {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  },
  async set(key, value) {
    await AsyncStorage.setItem(key, String(value));
  },
};

/**
 * App-wide sync service singleton. Exposes the brief's public API:
 * `pushChanges`, `pullChanges`, `getSyncStatus`, `onSyncComplete`, `poll`.
 */
export const syncService = new SyncEngine({
  remote: supabaseRemote,
  local: sqliteLocalStore,
  cursors: asyncStorageCursors,
  tables: DEFAULT_SYNC_TABLES,
  isEnabled: () => supabaseService.isConfigured(),
});
