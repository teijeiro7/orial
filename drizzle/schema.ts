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

// ── Tasks (Day Tracker + To-Do) ──────────────────────────────────────────────

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  scheduledHour: integer('scheduled_hour'), // 0-23, null = unscheduled
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  priority: integer('priority').notNull().default(0), // 0=normal 1=high
  pushedFrom: text('pushed_from'), // original date if migrated via push-to-tomorrow
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ── Gym (Progressive Overload) ───────────────────────────────────────────────

export const gymRoutines = sqliteTable('gym_routines', {
  id: text('id').primaryKey(),
  name: text('name').notNull(), // e.g. "Push", "Pull", "Legs"
  emoji: text('emoji').notNull().default('💪'),
  days: text('days').notNull().default('[]'), // JSON [1,2,3,4,5,6,7] (1=Mon)
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const gymExercises = sqliteTable('gym_exercises', {
  id: text('id').primaryKey(),
  routineId: text('routine_id').notNull().references(() => gymRoutines.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  targetSets: integer('target_sets').notNull().default(3),
  targetRepsMin: integer('target_reps_min').notNull().default(8),
  targetRepsMax: integer('target_reps_max').notNull().default(12),
  currentWeightKg: real('current_weight_kg').notNull().default(0),
  incrementKg: real('increment_kg').notNull().default(2.5),
  orderIndex: integer('order_index').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const gymSessions = sqliteTable('gym_sessions', {
  id: text('id').primaryKey(),
  routineId: text('routine_id').notNull().references(() => gymRoutines.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // YYYY-MM-DD
  // WHOOP data
  strainScore: real('strain_score'),
  kilojoule: real('kilojoule'),
  durationMin: integer('duration_min'),
  avgHeartRate: real('avg_heart_rate'),
  maxHeartRate: real('max_heart_rate'),
  zonesJson: text('zones_json'), // JSON {z1,z2,z3,z4,z5} percentages
  // Manual tracking
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const gymSets = sqliteTable('gym_sets', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => gymSessions.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id').notNull().references(() => gymExercises.id, { onDelete: 'cascade' }),
  setNumber: integer('set_number').notNull(),
  reps: integer('reps').notNull(),
  weightKg: real('weight_kg').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ── Finance ──────────────────────────────────────────────────────────────────

export const financeAccounts = sqliteTable('finance_accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull().default('bank'), // bank | crypto | stocks | real_estate | other
  balanceAmount: real('balance_amount').notNull().default(0),
  currency: text('currency').notNull().default('EUR'),
  icon: text('icon').notNull().default('💳'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const financeSubscriptions = sqliteTable('finance_subscriptions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('EUR'),
  billingDay: integer('billing_day').notNull(), // 1-31
  billingCycle: text('billing_cycle').notNull().default('monthly'), // monthly | yearly
  accountId: text('account_id').references(() => financeAccounts.id, { onDelete: 'set null' }),
  category: text('category').notNull().default('other'), // streaming | software | fitness | other
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  autoDeduct: integer('auto_deduct', { mode: 'boolean' }).notNull().default(false),
  lastBilledDate: text('last_billed_date'), // YYYY-MM-DD
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const financeOrders = sqliteTable('finance_orders', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('EUR'),
  accountId: text('account_id').references(() => financeAccounts.id, { onDelete: 'set null' }),
  orderDate: text('order_date').notNull(), // YYYY-MM-DD
  estimatedDeliveryDate: text('estimated_delivery_date'), // YYYY-MM-DD
  deliveredAt: integer('delivered_at', { mode: 'timestamp' }),
  status: text('status').notNull().default('pending'), // pending | shipped | delivered
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const financeWishlist = sqliteTable('finance_wishlist', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  price: real('price').notNull(),
  currency: text('currency').notNull().default('EUR'),
  url: text('url'),
  notes: text('notes'),
  priority: integer('priority').notNull().default(0), // 0=normal 1=high
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const financeIncome = sqliteTable('finance_income', {
  id: text('id').primaryKey(),
  description: text('description').notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('EUR'),
  category: text('category').notNull().default('other'), // salario | freelance | inversiones | regalo | other
  date: text('date').notNull(), // YYYY-MM-DD
  accountId: text('account_id').references(() => financeAccounts.id, { onDelete: 'set null' }),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const financeExpenses = sqliteTable('finance_expenses', {
  id: text('id').primaryKey(),
  description: text('description').notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('EUR'),
  category: text('category').notNull().default('other'), // comida | transporte | ocio | salud | compras | hogar | other
  date: text('date').notNull(), // YYYY-MM-DD
  accountId: text('account_id').references(() => financeAccounts.id, { onDelete: 'set null' }),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ── Hydration Profile (dynamic calculator) ───────────────────────────────────

export const hydrationProfile = sqliteTable('hydration_profile', {
  id: text('id').primaryKey().default('default'),
  weightKg: real('weight_kg').notNull().default(70),
  ageYears: integer('age_years').notNull().default(25),
  gender: text('gender').notNull().default('male'), // male | female
  trainingHoursPerDay: real('training_hours_per_day').notNull().default(1),
  caffeineMgPerDay: integer('caffeine_mg_per_day').notNull().default(0),
  stimulantMeds: integer('stimulant_meds', { mode: 'boolean' }).notNull().default(false),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ── New types ────────────────────────────────────────────────────────────────

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type GymRoutine = typeof gymRoutines.$inferSelect;
export type NewGymRoutine = typeof gymRoutines.$inferInsert;
export type GymExercise = typeof gymExercises.$inferSelect;
export type NewGymExercise = typeof gymExercises.$inferInsert;
export type GymSession = typeof gymSessions.$inferSelect;
export type NewGymSession = typeof gymSessions.$inferInsert;
export type GymSet = typeof gymSets.$inferSelect;
export type NewGymSet = typeof gymSets.$inferInsert;
export type FinanceAccount = typeof financeAccounts.$inferSelect;
export type NewFinanceAccount = typeof financeAccounts.$inferInsert;
export type FinanceSubscription = typeof financeSubscriptions.$inferSelect;
export type NewFinanceSubscription = typeof financeSubscriptions.$inferInsert;
export type FinanceOrder = typeof financeOrders.$inferSelect;
export type NewFinanceOrder = typeof financeOrders.$inferInsert;
export type FinanceWishlistItem = typeof financeWishlist.$inferSelect;
export type NewFinanceWishlistItem = typeof financeWishlist.$inferInsert;
export type HydrationProfile = typeof hydrationProfile.$inferSelect;
export type NewHydrationProfile = typeof hydrationProfile.$inferInsert;
export type FinanceExpense = typeof financeExpenses.$inferSelect;
export type NewFinanceExpense = typeof financeExpenses.$inferInsert;
export type FinanceIncome = typeof financeIncome.$inferSelect;
export type NewFinanceIncome = typeof financeIncome.$inferInsert;
