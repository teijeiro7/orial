import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const habits = sqliteTable('habits', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  emoji: text('emoji').notNull().default('✅'),
  category: text('category').notNull(),
  frequency: text('frequency').notNull(),
  targetDays: text('target_days').notNull(), // JSON array [1,2,3,4,5]
  targetCount: integer('target_count').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  description: text('description'),
  notionPageId: text('notion_page_id'),
  color: text('color'),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  isAiSuggested: integer('is_ai_suggested', { mode: 'boolean' }).notNull().default(false),
});

export const habitEntries = sqliteTable('habit_entries', {
  id: text('id').primaryKey(),
  habitId: text('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  completed: integer('completed', { mode: 'boolean' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  note: text('note'),
  notionEntryId: text('notion_entry_id'),
  isSynced: integer('is_synced', { mode: 'boolean' }).notNull().default(false),
});

export const reminders = sqliteTable('reminders', {
  id: text('id').primaryKey(),
  habitId: text('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
  time: text('time').notNull(), // HH:MM format
  days: text('days').notNull(), // JSON array [1,2,3,4,5]
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  calendarEventId: text('calendar_event_id'),
});

export const syncQueue = sqliteTable('sync_queue', {
  id: text('id').primaryKey(),
  operation: text('operation').notNull(), // create | update | delete
  entity: text('entity').notNull(), // habit | entry | reminder
  entityId: text('entity_id').notNull(),
  payload: text('payload').notNull(), // JSON
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  retryCount: integer('retry_count').notNull().default(0),
  lastError: text('last_error'),
});

export const userSettings = sqliteTable('user_settings', {
  id: text('id').primaryKey().default('default'),
  notionAccessToken: text('notion_access_token'),
  notionHabitsDbId: text('notion_habits_db_id'),
  notionLogsDbId: text('notion_logs_db_id'),
  calendarAccountId: text('calendar_account_id'),
  calendarProvider: text('calendar_provider').default('icloud'),
  darkMode: integer('dark_mode', { mode: 'boolean' }).notNull().default(true),
  aiRemindersEnabled: integer('ai_reminders_enabled', { mode: 'boolean' }).notNull().default(true),
  syncFrequency: text('sync_frequency').default('realtime'),
  fcmToken: text('fcm_token'),
});

export const whoopTokens = sqliteTable('whoop_tokens', {
  id: text('id').primaryKey().default('default'),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  whoopUserId: integer('whoop_user_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const whoopDaily = sqliteTable('whoop_daily', {
  date: text('date').primaryKey(),
  strain: real('strain'),
  kilojoule: real('kilojoule'),
  avgHeartRate: integer('avg_heart_rate'),
  maxHeartRate: integer('max_heart_rate'),
  recoveryScore: integer('recovery_score'),
  restingHeartRate: integer('resting_heart_rate'),
  hrvRmssdMilli: real('hrv_rmssd_milli'),
  spo2Percentage: real('spo2_percentage'),
  skinTempCelsius: real('skin_temp_celsius'),
  sleepPerformance: integer('sleep_performance'),
  sleepDurationMilli: integer('sleep_duration_milli'),
  respiratoryRate: real('respiratory_rate'),
  nap: integer('nap', { mode: 'boolean' }),
  raw: text('raw'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const bodyMetrics = sqliteTable('body_metrics', {
  id: text('id').primaryKey(),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  weightKg: real('weight_kg'),
  bodyFatPct: real('body_fat_pct'),
  notes: text('notes'),
  photoUri: text('photo_uri'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const pedometerHistory = sqliteTable('pedometer_history', {
  date: text('date').primaryKey(),
  steps: integer('steps').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type Habit = typeof habits.$inferSelect;
export type NewHabit = typeof habits.$inferInsert;
export type HabitEntry = typeof habitEntries.$inferSelect;
export type NewHabitEntry = typeof habitEntries.$inferInsert;
export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;
export type SyncQueueItem = typeof syncQueue.$inferSelect;
export type NewSyncQueueItem = typeof syncQueue.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
export type WhoopToken = typeof whoopTokens.$inferSelect;
export type NewWhoopToken = typeof whoopTokens.$inferInsert;
export type WhoopDaily = typeof whoopDaily.$inferSelect;
export type NewWhoopDaily = typeof whoopDaily.$inferInsert;
export type BodyMetric = typeof bodyMetrics.$inferSelect;
export type NewBodyMetric = typeof bodyMetrics.$inferInsert;
export type PedometerEntry = typeof pedometerHistory.$inferSelect;
export type NewPedometerEntry = typeof pedometerHistory.$inferInsert;
