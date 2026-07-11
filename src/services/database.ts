import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import * as schema from '../../drizzle/schema';

export const expoDb = openDatabaseSync('orial.db');
export const db = drizzle(expoDb, { schema });

export function useDatabaseMigrations() {
  const m = require('../../drizzle/migrations/migrations.js');
  return useMigrations(db, m.default ?? m);
}
