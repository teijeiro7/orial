import AsyncStorage from '@react-native-async-storage/async-storage';
import { expoDb } from './database';
import { supabaseService } from './supabaseService';
import { DEFAULT_SYNC_TABLES } from './syncService';
import type { SyncRow } from './syncEngine';

const MIGRATED_FLAG = 'supabase:migrated';

export interface MigrationTableResult {
  table: string;
  migrated: number;
  error?: string;
}

export interface MigrationResult {
  success: boolean;
  alreadyMigrated: boolean;
  tables: MigrationTableResult[];
  totalMigrated: number;
}

/**
 * One-off migration: reads every local SQLite row from the synced tables and
 * upserts it into Supabase. Idempotent — safe to re-run (upsert on the primary
 * key) — and guarded by a flag so it only runs once automatically.
 *
 * Returns per-table counts. On any table error the flag is NOT set, so a later
 * call retries. Pass `force: true` to run even if the flag is already set.
 */
export async function migrateLocalToSupabase(
  options: { force?: boolean } = {},
): Promise<MigrationResult> {
  if (!supabaseService.isConfigured()) {
    return { success: false, alreadyMigrated: false, tables: [], totalMigrated: 0 };
  }

  if (!options.force && (await AsyncStorage.getItem(MIGRATED_FLAG)) === 'true') {
    return { success: true, alreadyMigrated: true, tables: [], totalMigrated: 0 };
  }

  const tables: MigrationTableResult[] = [];
  let totalMigrated = 0;
  let allOk = true;

  for (const config of DEFAULT_SYNC_TABLES) {
    try {
      const rows = (await expoDb.getAllAsync(`SELECT * FROM ${config.table}`)) as SyncRow[];
      for (const row of rows) {
        await supabaseService.upsert(config.table, row, config.conflictKey);
      }
      tables.push({ table: config.table, migrated: rows.length });
      totalMigrated += rows.length;
    } catch (error) {
      allOk = false;
      tables.push({
        table: config.table,
        migrated: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (allOk) await AsyncStorage.setItem(MIGRATED_FLAG, 'true');

  return { success: allOk, alreadyMigrated: false, tables, totalMigrated };
}
