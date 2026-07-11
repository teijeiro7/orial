import AsyncStorage from '@react-native-async-storage/async-storage';
import { expoDb } from './database';
import { supabaseService } from './supabaseService';
import {
  SyncEngine,
  shouldApplyIncoming,
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
 * Cursor choice:
 *   - Tables carrying a mutable `updated_at` (they rewrite it on every edit)
 *     use it directly.
 *   - Every other synced table uses `modified_at` — a dedicated cursor column
 *     bumped by an AFTER INSERT/UPDATE trigger (see migration 0004). `created_at`
 *     is NEVER used as the cursor because it is immutable, so edits to an
 *     existing row would never advance the cursor and would never be pushed.
 *
 * The Vitality table insight_logs and the extra gym_exercises columns are
 * added to the Supabase migration by tasks T2/T6; they can be registered here
 * in those branches once their local schema exists. caffeine_logs (T1) is
 * registered below now that its local schema and modified_at cursor exist.
 */
export const DEFAULT_SYNC_TABLES: SyncTableConfig[] = [
  { table: 'habits', timestampField: 'modified_at', conflictKey: 'id' },
  { table: 'habit_entries', timestampField: 'modified_at', conflictKey: 'id' },
  { table: 'whoop_tokens', timestampField: 'modified_at', conflictKey: 'id' },
  { table: 'whoop_daily', timestampField: 'updated_at', conflictKey: 'date' },
  { table: 'body_metrics', timestampField: 'modified_at', conflictKey: 'id' },
  { table: 'pedometer_history', timestampField: 'updated_at', conflictKey: 'date' },
  { table: 'hydration', timestampField: 'updated_at', conflictKey: 'date' },
  { table: 'sodium_intake', timestampField: 'modified_at', conflictKey: 'id' },
  { table: 'supplements', timestampField: 'modified_at', conflictKey: 'id' },
  { table: 'supplement_logs', timestampField: 'modified_at', conflictKey: 'id' },
  { table: 'manual_metrics', timestampField: 'updated_at', conflictKey: 'date' },
  { table: 'weight_predictions', timestampField: 'updated_at', conflictKey: 'date' },
  { table: 'nutrition_logs', timestampField: 'modified_at', conflictKey: 'id' },
  { table: 'tasks', timestampField: 'modified_at', conflictKey: 'id' },
  { table: 'gym_routines', timestampField: 'modified_at', conflictKey: 'id' },
  { table: 'gym_exercises', timestampField: 'modified_at', conflictKey: 'id' },
  { table: 'gym_sessions', timestampField: 'modified_at', conflictKey: 'id' },
  { table: 'gym_sets', timestampField: 'modified_at', conflictKey: 'id' },
  { table: 'finance_accounts', timestampField: 'updated_at', conflictKey: 'id' },
  { table: 'finance_subscriptions', timestampField: 'modified_at', conflictKey: 'id' },
  { table: 'finance_orders', timestampField: 'modified_at', conflictKey: 'id' },
  { table: 'finance_wishlist', timestampField: 'modified_at', conflictKey: 'id' },
  { table: 'hydration_profile', timestampField: 'updated_at', conflictKey: 'id' },
  { table: 'caffeine_logs', timestampField: 'modified_at', conflictKey: 'id' },
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

    // Last-write-wins: delegate the tiebreak to the pure, unit-tested helper.
    const existingTs = existing && typeof existing.ts === 'number' ? existing.ts : null;
    if (!shouldApplyIncoming(existingTs, incomingTs)) {
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
