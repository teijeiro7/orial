-- ============================================================================
-- Orial v2 — Initial Supabase (PostgreSQL) schema
-- ============================================================================
-- Mirrors the local SQLite schema in drizzle/schema.ts so the app's sync layer
-- (src/services/syncService.ts) can replicate rows 1:1 by column name.
--
-- Type mapping (kept storage-compatible with SQLite so raw sync values pass
-- straight through):
--   SQLite TEXT              -> TEXT
--   SQLite INTEGER           -> BIGINT
--   SQLite INTEGER timestamp -> BIGINT   (Unix epoch, as stored locally)
--   SQLite INTEGER boolean   -> INTEGER  (0/1, as stored locally)
--   SQLite REAL              -> DOUBLE PRECISION
--
-- Apply from the Supabase dashboard SQL editor or the CLI:
--   supabase db push        (or paste this file into the SQL editor)
-- ============================================================================

-- ── Habits ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS habits (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  emoji           TEXT NOT NULL DEFAULT '✅',
  category        TEXT NOT NULL,
  frequency       TEXT NOT NULL,
  target_days     TEXT NOT NULL,
  target_count    BIGINT NOT NULL DEFAULT 1,
  created_at      BIGINT NOT NULL,
  description     TEXT,
  notion_page_id  TEXT,
  color           TEXT,
  is_archived     INTEGER NOT NULL DEFAULT 0,
  is_ai_suggested INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS habit_entries (
  id              TEXT PRIMARY KEY,
  habit_id        TEXT NOT NULL,
  date            BIGINT NOT NULL,
  completed       INTEGER NOT NULL,
  created_at      BIGINT NOT NULL,
  note            TEXT,
  notion_entry_id TEXT,
  is_synced       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reminders (
  id                TEXT PRIMARY KEY,
  habit_id          TEXT NOT NULL,
  time              TEXT NOT NULL,
  days              TEXT NOT NULL,
  is_active         INTEGER NOT NULL DEFAULT 1,
  calendar_event_id TEXT
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id          TEXT PRIMARY KEY,
  operation   TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  payload     TEXT NOT NULL,
  created_at  BIGINT NOT NULL,
  retry_count BIGINT NOT NULL DEFAULT 0,
  last_error  TEXT
);

CREATE TABLE IF NOT EXISTS user_settings (
  id                    TEXT PRIMARY KEY DEFAULT 'default',
  notion_access_token   TEXT,
  notion_habits_db_id   TEXT,
  notion_logs_db_id     TEXT,
  calendar_account_id   TEXT,
  calendar_provider     TEXT DEFAULT 'icloud',
  dark_mode             INTEGER NOT NULL DEFAULT 1,
  ai_reminders_enabled  INTEGER NOT NULL DEFAULT 1,
  sync_frequency        TEXT DEFAULT 'realtime',
  fcm_token             TEXT
);

-- ── WHOOP ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whoop_tokens (
  id            TEXT PRIMARY KEY DEFAULT 'default',
  access_token  TEXT,
  refresh_token TEXT,
  expires_at    BIGINT,
  scope         TEXT,
  whoop_user_id BIGINT,
  created_at    BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS whoop_daily (
  date                TEXT PRIMARY KEY,
  strain              DOUBLE PRECISION,
  kilojoule           DOUBLE PRECISION,
  avg_heart_rate      BIGINT,
  max_heart_rate      BIGINT,
  recovery_score      BIGINT,
  resting_heart_rate  BIGINT,
  hrv_rmssd_milli     DOUBLE PRECISION,
  spo2_percentage     DOUBLE PRECISION,
  skin_temp_celsius   DOUBLE PRECISION,
  sleep_performance   BIGINT,
  sleep_duration_milli BIGINT,
  respiratory_rate    DOUBLE PRECISION,
  nap                 INTEGER,
  raw                 TEXT,
  updated_at          BIGINT NOT NULL
);

-- ── Body & activity ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS body_metrics (
  id           TEXT PRIMARY KEY,
  date         BIGINT NOT NULL,
  weight_kg    DOUBLE PRECISION,
  body_fat_pct DOUBLE PRECISION,
  notes        TEXT,
  photo_uri    TEXT,
  created_at   BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS pedometer_history (
  date       TEXT PRIMARY KEY,
  steps      BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL
);

-- ── Hydration & nutrition ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hydration (
  date                     TEXT PRIMARY KEY,
  target_liters            DOUBLE PRECISION NOT NULL DEFAULT 3.0,
  consumed_liters          DOUBLE PRECISION NOT NULL DEFAULT 0,
  effective_liters         DOUBLE PRECISION NOT NULL DEFAULT 0,
  sodium_mg                BIGINT NOT NULL DEFAULT 0,
  extra_liters_from_sodium DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at               BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS sodium_intake (
  id         TEXT PRIMARY KEY,
  date       TEXT NOT NULL,
  source     TEXT NOT NULL,
  sodium_mg  BIGINT NOT NULL,
  meal_type  TEXT,
  notes      TEXT,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS supplements (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'creatine',
  daily_dose_mg BIGINT NOT NULL DEFAULT 5000,
  reminder_time TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS supplement_logs (
  id            TEXT PRIMARY KEY,
  supplement_id TEXT NOT NULL,
  date          TEXT NOT NULL,
  dose_mg       BIGINT NOT NULL,
  taken_at      BIGINT,
  skipped       INTEGER NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS manual_metrics (
  date             TEXT PRIMARY KEY,
  calories_in      BIGINT,
  protein_g        BIGINT,
  carbs_g          BIGINT,
  fat_g            BIGINT,
  sodium_mg        BIGINT,
  fiber_g          BIGINT,
  steps_walk       BIGINT,
  steps_conscious  BIGINT,
  workout_minutes  BIGINT,
  workout_type     TEXT,
  workout_calories BIGINT,
  bowel_movement   INTEGER,
  bowel_volume     TEXT,
  sleep_quality    BIGINT,
  stress_level     BIGINT,
  notes            TEXT,
  updated_at       BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS weight_predictions (
  date                  TEXT PRIMARY KEY,
  actual_weight_kg      DOUBLE PRECISION,
  predicted_weight_kg   DOUBLE PRECISION,
  prediction_range_low  DOUBLE PRECISION,
  prediction_range_high DOUBLE PRECISION,
  predicted_delta_kg    DOUBLE PRECISION,
  factors               TEXT,
  confidence            DOUBLE PRECISION,
  updated_at            BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS nutrition_logs (
  id             TEXT PRIMARY KEY,
  date           TEXT NOT NULL,
  source         TEXT NOT NULL DEFAULT 'openclaw',
  total_calories BIGINT,
  protein_g      BIGINT,
  carbs_g        BIGINT,
  fat_g          BIGINT,
  sodium_mg      BIGINT,
  fiber_g        BIGINT,
  raw_data       TEXT,
  created_at     BIGINT NOT NULL
);

-- ── Tasks ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  date           TEXT NOT NULL,
  scheduled_hour BIGINT,
  completed      INTEGER NOT NULL DEFAULT 0,
  priority       BIGINT NOT NULL DEFAULT 0,
  pushed_from    TEXT,
  completed_at   BIGINT,
  created_at     BIGINT NOT NULL
);

-- ── Gym ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gym_routines (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  emoji      TEXT NOT NULL DEFAULT '💪',
  days       TEXT NOT NULL DEFAULT '[]',
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS gym_exercises (
  id                TEXT PRIMARY KEY,
  routine_id        TEXT NOT NULL,
  name              TEXT NOT NULL,
  target_sets       BIGINT NOT NULL DEFAULT 3,
  target_reps_min   BIGINT NOT NULL DEFAULT 8,
  target_reps_max   BIGINT NOT NULL DEFAULT 12,
  current_weight_kg DOUBLE PRECISION NOT NULL DEFAULT 0,
  increment_kg      DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  order_index       BIGINT NOT NULL DEFAULT 0,
  created_at        BIGINT NOT NULL,
  -- Vitality additions (consumed by task T2 — exercise swaps & 1RM):
  swap_group        TEXT,             -- same group = interchangeable exercises
  one_rm_estimated  DOUBLE PRECISION, -- estimated one-rep max
  last_swapped_at   BIGINT            -- Unix ms, last time this exercise was swapped
);

CREATE TABLE IF NOT EXISTS gym_sessions (
  id         TEXT PRIMARY KEY,
  routine_id TEXT NOT NULL,
  date       TEXT NOT NULL,
  notes      TEXT,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS gym_sets (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  set_number  BIGINT NOT NULL,
  reps        BIGINT NOT NULL,
  weight_kg   DOUBLE PRECISION NOT NULL,
  created_at  BIGINT NOT NULL
);

-- ── Finance ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finance_accounts (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  type           TEXT NOT NULL DEFAULT 'bank',
  balance_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'EUR',
  icon           TEXT NOT NULL DEFAULT '💳',
  updated_at     BIGINT NOT NULL,
  created_at     BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS finance_subscriptions (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  amount           DOUBLE PRECISION NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'EUR',
  billing_day      BIGINT NOT NULL,
  billing_cycle    TEXT NOT NULL DEFAULT 'monthly',
  account_id       TEXT,
  category         TEXT NOT NULL DEFAULT 'other',
  is_active        INTEGER NOT NULL DEFAULT 1,
  auto_deduct      INTEGER NOT NULL DEFAULT 0,
  last_billed_date TEXT,
  created_at       BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS finance_orders (
  id                      TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  amount                  DOUBLE PRECISION NOT NULL,
  currency                TEXT NOT NULL DEFAULT 'EUR',
  account_id              TEXT,
  order_date              TEXT NOT NULL,
  estimated_delivery_date TEXT,
  delivered_at            BIGINT,
  status                  TEXT NOT NULL DEFAULT 'pending',
  created_at              BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS finance_wishlist (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  price      DOUBLE PRECISION NOT NULL,
  currency   TEXT NOT NULL DEFAULT 'EUR',
  url        TEXT,
  notes      TEXT,
  priority   BIGINT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);

-- ── Hydration profile ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hydration_profile (
  id                     TEXT PRIMARY KEY DEFAULT 'default',
  weight_kg              DOUBLE PRECISION NOT NULL DEFAULT 70,
  age_years              BIGINT NOT NULL DEFAULT 25,
  gender                 TEXT NOT NULL DEFAULT 'male',
  training_hours_per_day DOUBLE PRECISION NOT NULL DEFAULT 1,
  caffeine_mg_per_day    BIGINT NOT NULL DEFAULT 0,
  stimulant_meds         INTEGER NOT NULL DEFAULT 0,
  updated_at             BIGINT NOT NULL
);

-- ── Vitality-specific tables (new) ───────────────────────────────────────────
-- caffeine_logs is populated by task T1; insight_logs by task T6.
CREATE TABLE IF NOT EXISTS caffeine_logs (
  id          TEXT PRIMARY KEY,
  source      TEXT NOT NULL DEFAULT 'manual', -- manual, coffee, energy_drink, supplement
  caffeine_mg BIGINT NOT NULL,
  timestamp   BIGINT NOT NULL,                -- Unix ms
  notes       TEXT,
  created_at  BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS insight_logs (
  id           TEXT PRIMARY KEY,
  generated_at BIGINT NOT NULL,
  category     TEXT NOT NULL,                 -- sleep, gym, finance, nutrition, mixed
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  severity     TEXT NOT NULL DEFAULT 'info',  -- info, warning, critical
  dismissed    INTEGER NOT NULL DEFAULT 0,
  source_agent TEXT NOT NULL DEFAULT 'jarvis',
  created_at   BIGINT NOT NULL
);

-- ── modified_at sync cursor (local→cloud EDIT propagation) ──────────────────
-- The app cursors mutable tables on modified_at (NOT the immutable created_at)
-- so EDITS to existing rows are pushed, not just inserts. The BEFORE trigger
-- keeps modified_at current for rows written directly on Supabase (e.g. by
-- Jarvis); rows pushed by the app carry their own local modified_at, which is
-- preserved (NEW.modified_at is left untouched when the writer already set it).
ALTER TABLE habits                  ADD COLUMN IF NOT EXISTS modified_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE habit_entries           ADD COLUMN IF NOT EXISTS modified_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE whoop_tokens            ADD COLUMN IF NOT EXISTS modified_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE body_metrics            ADD COLUMN IF NOT EXISTS modified_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE sodium_intake           ADD COLUMN IF NOT EXISTS modified_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE supplements             ADD COLUMN IF NOT EXISTS modified_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE supplement_logs         ADD COLUMN IF NOT EXISTS modified_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE nutrition_logs          ADD COLUMN IF NOT EXISTS modified_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE tasks                   ADD COLUMN IF NOT EXISTS modified_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE gym_routines            ADD COLUMN IF NOT EXISTS modified_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE gym_exercises           ADD COLUMN IF NOT EXISTS modified_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE gym_sessions            ADD COLUMN IF NOT EXISTS modified_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE gym_sets                ADD COLUMN IF NOT EXISTS modified_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE finance_subscriptions   ADD COLUMN IF NOT EXISTS modified_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE finance_orders          ADD COLUMN IF NOT EXISTS modified_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE finance_wishlist        ADD COLUMN IF NOT EXISTS modified_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE caffeine_logs           ADD COLUMN IF NOT EXISTS modified_at BIGINT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION bump_modified_at() RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND (NEW.modified_at IS NULL OR NEW.modified_at = 0))
     OR (TG_OP = 'UPDATE' AND NEW.modified_at IS NOT DISTINCT FROM OLD.modified_at) THEN
    NEW.modified_at := floor(extract(epoch from now()))::bigint;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_habits_modified_at         BEFORE INSERT OR UPDATE ON habits                  FOR EACH ROW EXECUTE FUNCTION bump_modified_at();
CREATE OR REPLACE TRIGGER trg_habit_entries_modified_at  BEFORE INSERT OR UPDATE ON habit_entries           FOR EACH ROW EXECUTE FUNCTION bump_modified_at();
CREATE OR REPLACE TRIGGER trg_whoop_tokens_modified_at   BEFORE INSERT OR UPDATE ON whoop_tokens            FOR EACH ROW EXECUTE FUNCTION bump_modified_at();
CREATE OR REPLACE TRIGGER trg_body_metrics_modified_at   BEFORE INSERT OR UPDATE ON body_metrics            FOR EACH ROW EXECUTE FUNCTION bump_modified_at();
CREATE OR REPLACE TRIGGER trg_sodium_intake_modified_at  BEFORE INSERT OR UPDATE ON sodium_intake           FOR EACH ROW EXECUTE FUNCTION bump_modified_at();
CREATE OR REPLACE TRIGGER trg_supplements_modified_at    BEFORE INSERT OR UPDATE ON supplements             FOR EACH ROW EXECUTE FUNCTION bump_modified_at();
CREATE OR REPLACE TRIGGER trg_supplement_logs_modified_at  BEFORE INSERT OR UPDATE ON supplement_logs         FOR EACH ROW EXECUTE FUNCTION bump_modified_at();
CREATE OR REPLACE TRIGGER trg_nutrition_logs_modified_at  BEFORE INSERT OR UPDATE ON nutrition_logs          FOR EACH ROW EXECUTE FUNCTION bump_modified_at();
CREATE OR REPLACE TRIGGER trg_tasks_modified_at          BEFORE INSERT OR UPDATE ON tasks                   FOR EACH ROW EXECUTE FUNCTION bump_modified_at();
CREATE OR REPLACE TRIGGER trg_gym_routines_modified_at   BEFORE INSERT OR UPDATE ON gym_routines            FOR EACH ROW EXECUTE FUNCTION bump_modified_at();
CREATE OR REPLACE TRIGGER trg_gym_exercises_modified_at  BEFORE INSERT OR UPDATE ON gym_exercises           FOR EACH ROW EXECUTE FUNCTION bump_modified_at();
CREATE OR REPLACE TRIGGER trg_gym_sessions_modified_at   BEFORE INSERT OR UPDATE ON gym_sessions            FOR EACH ROW EXECUTE FUNCTION bump_modified_at();
CREATE OR REPLACE TRIGGER trg_gym_sets_modified_at       BEFORE INSERT OR UPDATE ON gym_sets                FOR EACH ROW EXECUTE FUNCTION bump_modified_at();
CREATE OR REPLACE TRIGGER trg_finance_subscriptions_modified_at  BEFORE INSERT OR UPDATE ON finance_subscriptions   FOR EACH ROW EXECUTE FUNCTION bump_modified_at();
CREATE OR REPLACE TRIGGER trg_finance_orders_modified_at  BEFORE INSERT OR UPDATE ON finance_orders          FOR EACH ROW EXECUTE FUNCTION bump_modified_at();
CREATE OR REPLACE TRIGGER trg_finance_wishlist_modified_at  BEFORE INSERT OR UPDATE ON finance_wishlist        FOR EACH ROW EXECUTE FUNCTION bump_modified_at();
CREATE OR REPLACE TRIGGER trg_caffeine_logs_modified_at  BEFORE INSERT OR UPDATE ON caffeine_logs            FOR EACH ROW EXECUTE FUNCTION bump_modified_at();

-- modified_at range-scan indexes (speed up pullChanges):
CREATE INDEX IF NOT EXISTS idx_habits_modified_at         ON habits                  (modified_at);
CREATE INDEX IF NOT EXISTS idx_habit_entries_modified_at  ON habit_entries           (modified_at);
CREATE INDEX IF NOT EXISTS idx_whoop_tokens_modified_at   ON whoop_tokens            (modified_at);
CREATE INDEX IF NOT EXISTS idx_body_metrics_modified_at   ON body_metrics            (modified_at);
CREATE INDEX IF NOT EXISTS idx_sodium_intake_modified_at  ON sodium_intake           (modified_at);
CREATE INDEX IF NOT EXISTS idx_supplements_modified_at    ON supplements             (modified_at);
CREATE INDEX IF NOT EXISTS idx_supplement_logs_modified_at  ON supplement_logs         (modified_at);
CREATE INDEX IF NOT EXISTS idx_nutrition_logs_modified_at  ON nutrition_logs          (modified_at);
CREATE INDEX IF NOT EXISTS idx_tasks_modified_at          ON tasks                   (modified_at);
CREATE INDEX IF NOT EXISTS idx_gym_routines_modified_at   ON gym_routines            (modified_at);
CREATE INDEX IF NOT EXISTS idx_gym_exercises_modified_at  ON gym_exercises           (modified_at);
CREATE INDEX IF NOT EXISTS idx_gym_sessions_modified_at   ON gym_sessions            (modified_at);
CREATE INDEX IF NOT EXISTS idx_gym_sets_modified_at       ON gym_sets                (modified_at);
CREATE INDEX IF NOT EXISTS idx_finance_subscriptions_modified_at  ON finance_subscriptions   (modified_at);
CREATE INDEX IF NOT EXISTS idx_finance_orders_modified_at  ON finance_orders          (modified_at);
CREATE INDEX IF NOT EXISTS idx_finance_wishlist_modified_at  ON finance_wishlist        (modified_at);
CREATE INDEX IF NOT EXISTS idx_caffeine_logs_modified_at  ON caffeine_logs            (modified_at);

-- ── Indexes on sync cursor columns (speed up pullChanges range scans) ────────
CREATE INDEX IF NOT EXISTS idx_habits_created_at            ON habits (created_at);
CREATE INDEX IF NOT EXISTS idx_habit_entries_created_at     ON habit_entries (created_at);
CREATE INDEX IF NOT EXISTS idx_whoop_daily_updated_at       ON whoop_daily (updated_at);
CREATE INDEX IF NOT EXISTS idx_body_metrics_created_at      ON body_metrics (created_at);
CREATE INDEX IF NOT EXISTS idx_pedometer_history_updated_at ON pedometer_history (updated_at);
CREATE INDEX IF NOT EXISTS idx_hydration_updated_at         ON hydration (updated_at);
CREATE INDEX IF NOT EXISTS idx_sodium_intake_created_at     ON sodium_intake (created_at);
CREATE INDEX IF NOT EXISTS idx_supplement_logs_created_at   ON supplement_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_manual_metrics_updated_at    ON manual_metrics (updated_at);
CREATE INDEX IF NOT EXISTS idx_weight_predictions_updated_at ON weight_predictions (updated_at);
CREATE INDEX IF NOT EXISTS idx_nutrition_logs_created_at    ON nutrition_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at             ON tasks (created_at);
CREATE INDEX IF NOT EXISTS idx_gym_sessions_created_at      ON gym_sessions (created_at);
CREATE INDEX IF NOT EXISTS idx_gym_sets_created_at          ON gym_sets (created_at);
CREATE INDEX IF NOT EXISTS idx_finance_accounts_updated_at  ON finance_accounts (updated_at);
CREATE INDEX IF NOT EXISTS idx_caffeine_logs_timestamp      ON caffeine_logs (timestamp);
CREATE INDEX IF NOT EXISTS idx_insight_logs_generated_at    ON insight_logs (generated_at);

-- ── Storage bucket for progress photos ───────────────────────────────────────
-- Public bucket: supabaseService.getPublicUrl()/uploadFile() return plain public
-- URLs (not signed URLs), which only resolve against a public bucket. Single-user
-- personal app today, so a guessable-but-unlisted URL is an acceptable tradeoff;
-- revisit (switch to signed URLs + private bucket) before going multi-user.
INSERT INTO storage.buckets (id, name, public)
VALUES ('progress-photos', 'progress-photos', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Row Level Security (RLS)
-- ----------------------------------------------------------------------------
-- Orial is currently a single-user personal app that talks to Supabase with the
-- anon key, and Jarvis (the server agent) uses the service_role key which
-- bypasses RLS. RLS is therefore left DISABLED so the app works out of the box.
--
-- BEFORE going multi-user: add a `user_id uuid` column to every table, enable
-- RLS, and add per-user policies, e.g.:
--   ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY "own rows" ON habits
--     USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- and a storage policy scoping progress-photos to the owning user.
-- ============================================================================
