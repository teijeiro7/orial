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

export const hydration = sqliteTable('hydration', {
  date: text('date').primaryKey(),
  targetLiters: real('target_liters').notNull().default(3.0),
  consumedLiters: real('consumed_liters').notNull().default(0),
  effectiveLiters: real('effective_liters').notNull().default(0),
  sodiumMg: integer('sodium_mg').notNull().default(0),
  extraLitersFromSodium: real('extra_liters_from_sodium').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const sodiumIntake = sqliteTable('sodium_intake', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  source: text('source').notNull(),
  sodiumMg: integer('sodium_mg').notNull(),
  mealType: text('meal_type'),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const supplements = sqliteTable('supplements', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull().default('creatine'),
  dailyDoseMg: integer('daily_dose_mg').notNull().default(5000),
  reminderTime: text('reminder_time'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const supplementLogs = sqliteTable('supplement_logs', {
  id: text('id').primaryKey(),
  supplementId: text('supplement_id').notNull().references(() => supplements.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  doseMg: integer('dose_mg').notNull(),
  takenAt: integer('taken_at', { mode: 'timestamp' }),
  skipped: integer('skipped', { mode: 'boolean' }).notNull().default(false),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const manualMetrics = sqliteTable('manual_metrics', {
  date: text('date').primaryKey(),
  caloriesIn: integer('calories_in'),
  proteinG: integer('protein_g'),
  carbsG: integer('carbs_g'),
  fatG: integer('fat_g'),
  sodiumMg: integer('sodium_mg'),
  fiberG: integer('fiber_g'),
  stepsWalk: integer('steps_walk'),
  stepsConscious: integer('steps_conscious'),
  workoutMinutes: integer('workout_minutes'),
  workoutType: text('workout_type'),
  workoutCalories: integer('workout_calories'),
  bowelMovement: integer('bowel_movement', { mode: 'boolean' }),
  bowelVolume: text('bowel_volume'),
  sleepQuality: integer('sleep_quality'),
  stressLevel: integer('stress_level'),
  notes: text('notes'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const weightPredictions = sqliteTable('weight_predictions', {
  date: text('date').primaryKey(),
  actualWeightKg: real('actual_weight_kg'),
  predictedWeightKg: real('predicted_weight_kg'),
  predictionRangeLow: real('prediction_range_low'),
  predictionRangeHigh: real('prediction_range_high'),
  predictedDeltaKg: real('predicted_delta_kg'),
  factors: text('factors'),
  confidence: real('confidence'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const nutritionLogs = sqliteTable('nutrition_logs', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  source: text('source').notNull().default('openclaw'),
  totalCalories: integer('total_calories'),
  proteinG: integer('protein_g'),
  carbsG: integer('carbs_g'),
  fatG: integer('fat_g'),
  sodiumMg: integer('sodium_mg'),
  fiberG: integer('fiber_g'),
  rawData: text('raw_data'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
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
export type Hydration = typeof hydration.$inferSelect;
export type NewHydration = typeof hydration.$inferInsert;
export type SodiumIntake = typeof sodiumIntake.$inferSelect;
export type NewSodiumIntake = typeof sodiumIntake.$inferInsert;
export type Supplement = typeof supplements.$inferSelect;
export type NewSupplement = typeof supplements.$inferInsert;
export type SupplementLog = typeof supplementLogs.$inferSelect;
export type NewSupplementLog = typeof supplementLogs.$inferInsert;
export type ManualMetric = typeof manualMetrics.$inferSelect;
export type NewManualMetric = typeof manualMetrics.$inferInsert;
export type WeightPrediction = typeof weightPredictions.$inferSelect;
export type NewWeightPrediction = typeof weightPredictions.$inferInsert;
export type NutritionLog = typeof nutritionLogs.$inferSelect;
export type NewNutritionLog = typeof nutritionLogs.$inferInsert;
