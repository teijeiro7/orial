-- ============================================================================
-- Orial — Whoop enrichment (workouts, sleep sessions, journal) + RLS
-- ============================================================================
-- Two independent changes, shipped together:
--
-- 1. Three new tables backed by the Whoop CSV bulk export (the Whoop v2 API
--    has no journal endpoint, so historical journal answers only ever arrive
--    via that one-time import) plus, going forward, whoopService.syncToday():
--      - whoop_workouts       (per-session training data; previously fetched
--                              via the API and discarded, never persisted)
--      - whoop_sleep_sessions (per-sleep-period detail incl. naps; whoop_daily
--                              only ever held one summarized sleep per date)
--      - whoop_journal_entries (long format: one row per daily behavioral
--                              question — new Whoop questions need no schema
--                              change)
--
-- 2. Row Level Security across every table (existing 27 + the 3 new ones).
--    Identity comes from Firebase (the app's real login), registered as a
--    Supabase Third-Party Auth provider (dashboard: Authentication →
--    Third-Party Auth → Firebase, project id `orial-4a639`). Once registered,
--    Supabase validates the Firebase ID token supabaseService.ts sends via
--    `accessToken`, and `auth.uid()` resolves to the token's `sub` claim (the
--    Firebase uid) — see https://supabase.com/docs/guides/auth/third-party/firebase-auth.
--
--    Policies deliberately omit `TO authenticated`: Firebase ID tokens don't
--    carry Supabase's `role` claim unless you additionally set a custom claim
--    server-side (Firebase Admin SDK), so a Firebase-authenticated request
--    lands as Postgres role `anon`, not `authenticated`. Scoping `TO public`
--    instead and relying purely on the `auth.uid() = user_id` ownership check
--    is still sound once `user_id` is backfilled and NOT NULL (see below): a
--    request with no token (auth.uid() IS NULL) matches zero rows, and a
--    request with someone else's Firebase token matches only their own
--    (empty) rows — never Cristian's. Revisit with the custom `role` claim +
--    `TO authenticated` if this ever needs defense against a compromised/
--    leaked service key rather than just the embedded anon key.
--
--    `user_id` ships NULLABLE in this migration: 6 tables (whoop_daily,
--    hydration, manual_metrics, weight_predictions, finance_accounts,
--    hydration_profile) already hold real rows from the anon-key-only sync
--    that's been running so far, and `auth.uid()` is NULL when this migration
--    runs (no PostgREST request/JWT in a migration session), so a NOT NULL
--    default couldn't backfill them. A NULL user_id also means RLS hides that
--    row from every request until backfilled — a safe fail-closed default,
--    not a data-loss risk (service_role/SQL access is unaffected). Follow-up
--    migration once Cristian's Firebase uid is known: backfill every existing
--    row (`UPDATE <table> SET user_id = '<uid>' WHERE user_id IS NULL`), then
--    `ALTER TABLE <table> ALTER COLUMN user_id SET NOT NULL` on all 30 tables.
-- ============================================================================

-- ── New tables ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS whoop_workouts (
  id               TEXT PRIMARY KEY,
  cycle_start      BIGINT NOT NULL,
  cycle_end        BIGINT,
  workout_start    BIGINT NOT NULL,
  workout_end      BIGINT NOT NULL,
  activity_name    TEXT NOT NULL,
  activity_strain  DOUBLE PRECISION,
  kilojoule        DOUBLE PRECISION,
  max_heart_rate   BIGINT,
  avg_heart_rate   BIGINT,
  hr_zone_1_pct    DOUBLE PRECISION,
  hr_zone_2_pct    DOUBLE PRECISION,
  hr_zone_3_pct    DOUBLE PRECISION,
  hr_zone_4_pct    DOUBLE PRECISION,
  hr_zone_5_pct    DOUBLE PRECISION,
  gps_enabled      INTEGER,
  source           TEXT NOT NULL DEFAULT 'csv_import', -- csv_import | api
  created_at       BIGINT NOT NULL,
  updated_at       BIGINT NOT NULL,
  user_id          uuid DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS whoop_sleep_sessions (
  id                     TEXT PRIMARY KEY,
  cycle_start            BIGINT NOT NULL,
  cycle_end              BIGINT,
  sleep_start            BIGINT NOT NULL,
  sleep_end              BIGINT NOT NULL,
  sleep_score_pct        BIGINT,
  respiratory_rate       DOUBLE PRECISION,
  sleep_duration_min     BIGINT,
  time_in_bed_min        BIGINT,
  light_sleep_min        BIGINT,
  deep_sleep_min         BIGINT,
  rem_sleep_min          BIGINT,
  awake_min              BIGINT,
  sleep_needed_min       BIGINT,
  sleep_debt_min         BIGINT,
  sleep_efficiency_pct   BIGINT,
  sleep_consistency_pct  BIGINT,
  is_nap                 INTEGER NOT NULL DEFAULT 0,
  source                 TEXT NOT NULL DEFAULT 'csv_import', -- csv_import | api
  created_at             BIGINT NOT NULL,
  updated_at             BIGINT NOT NULL,
  user_id                uuid DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS whoop_journal_entries (
  id             TEXT PRIMARY KEY,
  cycle_start    BIGINT NOT NULL,
  cycle_end      BIGINT,
  question_text  TEXT NOT NULL,
  answered_yes   INTEGER,
  notes          TEXT,
  created_at     BIGINT NOT NULL,
  user_id        uuid DEFAULT auth.uid()
);

CREATE UNIQUE INDEX IF NOT EXISTS whoop_journal_entries_cycle_question_unique
  ON whoop_journal_entries (cycle_start, question_text);

CREATE INDEX IF NOT EXISTS idx_whoop_workouts_updated_at ON whoop_workouts (updated_at);
CREATE INDEX IF NOT EXISTS idx_whoop_workouts_cycle_start ON whoop_workouts (cycle_start);
CREATE INDEX IF NOT EXISTS idx_whoop_sleep_sessions_updated_at ON whoop_sleep_sessions (updated_at);
CREATE INDEX IF NOT EXISTS idx_whoop_sleep_sessions_cycle_start ON whoop_sleep_sessions (cycle_start);
CREATE INDEX IF NOT EXISTS idx_whoop_journal_entries_created_at ON whoop_journal_entries (created_at);

-- ── user_id on every existing table ─────────────────────────────────────────
-- Nullable for now — see the NULL-vs-NOT-NULL note above. Most of these 27
-- tables hold 0 rows today, but a handful have real data and a NOT NULL
-- default can't backfill them mid-migration (auth.uid() is NULL outside a
-- PostgREST request), so every column ships nullable and gets backfilled +
-- locked to NOT NULL in a follow-up migration once the owning uid is known.

ALTER TABLE habits                ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE habit_entries         ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE reminders             ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE sync_queue            ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE user_settings         ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE whoop_daily           ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE body_metrics          ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE pedometer_history     ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE hydration             ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE sodium_intake         ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE supplements           ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE supplement_logs       ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE manual_metrics        ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE weight_predictions    ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE nutrition_logs        ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE tasks                 ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE gym_routines          ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE gym_exercises         ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE gym_sessions          ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE gym_sets              ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE finance_accounts      ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE finance_subscriptions ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE finance_orders        ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE finance_wishlist      ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE hydration_profile     ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE caffeine_logs         ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE insight_logs          ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();

-- ── Row Level Security: enable + one ownership policy per table ────────────

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'habits', 'habit_entries', 'reminders', 'sync_queue', 'user_settings',
    'whoop_daily', 'body_metrics', 'pedometer_history', 'hydration',
    'sodium_intake', 'supplements', 'supplement_logs', 'manual_metrics',
    'weight_predictions', 'nutrition_logs', 'tasks', 'gym_routines',
    'gym_exercises', 'gym_sessions', 'gym_sets', 'finance_accounts',
    'finance_subscriptions', 'finance_orders', 'finance_wishlist',
    'hydration_profile', 'caffeine_logs', 'insight_logs',
    'whoop_workouts', 'whoop_sleep_sessions', 'whoop_journal_entries'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "own rows" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "own rows" ON %I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
      t
    );
  END LOOP;
END $$;

-- ── Storage: scope progress-photos to the owning user's folder ─────────────
-- Path convention is already `{firebaseUid}/{date}.jpg` (progressPhotoService.ts),
-- so no app code change is needed — auth.uid() now equals that same uid.
-- The bucket itself stays public (documented tradeoff for direct-URL reads);
-- this policy scopes the Storage API (list/upload/list-your-own) that
-- progressPhotoService actually uses.

DROP POLICY IF EXISTS "own progress photos" ON storage.objects;
CREATE POLICY "own progress photos" ON storage.objects
  FOR ALL
  USING (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
