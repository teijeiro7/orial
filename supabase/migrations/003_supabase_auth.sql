-- ============================================================================
-- Orial — Supabase Auth cutover (replaces Firebase Third-Party Auth)
-- ============================================================================
-- The app now authenticates directly against Supabase Auth (email/password,
-- single user) instead of forwarding a Firebase ID token as the accessToken.
-- This migration finishes what 002 deliberately left half-done once identity
-- was still Firebase-shaped:
--
-- 1. Fixes the pre-existing sync cursor bug: 13 tables replicated by
--    src/services/syncService.ts declare `timestampField: 'updated_at'`, but
--    their real Postgres column (added by 001_initial.sql's bump_modified_at
--    machinery) is `modified_at`. Every pull against these tables has been
--    silently erroring. Renamed to `updated_at` with a matching trigger
--    function; the 3 non-synced tables that also use `modified_at`
--    (habits, habit_entries, finance_orders) are left untouched.
--
-- 2. Backfills `user_id` on all 30 tables for Cristian's one Supabase Auth
--    user (created via the dashboard, see auth.users) and locks the column
--    NOT NULL. Safe now that `user_id` is `uuid` and Supabase
--    Auth issues real uuids (Firebase's uid was a 28-char string — the wrong
--    type for this column, never actually compatible).
--
--    NOTE: the uuid below is specific to this single-user app. Re-running
--    this migration file against a different Supabase project (fresh clone,
--    fork) requires substituting the real auth.users id first.
--
-- 3. Tightens RLS to `TO authenticated`. 002 deliberately scoped policies
--    `TO public` because Firebase ID tokens carried no Supabase `role` claim.
--    Supabase Auth issues a real `authenticated` role, so this is no longer
--    a workaround — it's defense in depth on top of the ownership predicate.
--
-- 4. Makes the `progress-photos` bucket private (it held 0 objects) and
--    scopes its storage policy to `authenticated` too. The app now reads
--    photos via signed URLs (`supabaseService.createSignedUrl`).
--
-- 5. Fixes the pre-existing `rls_auto_enable` advisor warning (SECURITY
--    DEFINER function without a pinned search_path).
-- ============================================================================

-- ── 1. Sync cursor fix: modified_at → updated_at on the 13 synced tables ───

CREATE OR REPLACE FUNCTION bump_updated_at() RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND (NEW.updated_at IS NULL OR NEW.updated_at = 0))
     OR (TG_OP = 'UPDATE' AND NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at) THEN
    NEW.updated_at := floor(extract(epoch from now()))::bigint;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'body_metrics', 'caffeine_logs', 'finance_subscriptions', 'finance_wishlist',
    'gym_exercises', 'gym_routines', 'gym_sessions', 'gym_sets', 'nutrition_logs',
    'sodium_intake', 'supplement_logs', 'supplements', 'tasks'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I RENAME COLUMN modified_at TO updated_at', t);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_' || t || '_modified_at', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION bump_updated_at()',
      'trg_' || t || '_updated_at', t
    );
    EXECUTE format(
      'ALTER INDEX IF EXISTS %I RENAME TO %I',
      'idx_' || t || '_modified_at', 'idx_' || t || '_updated_at'
    );
  END LOOP;
END $$;

-- ── 2. Backfill user_id, then lock NOT NULL, on all 30 tables ──────────────

DO $$
DECLARE
  t TEXT;
  owner_uid CONSTANT uuid := '6d8e5361-b59a-4604-b6e0-b50796f24f3a'; -- see auth.users
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
    EXECUTE format('UPDATE %I SET user_id = $1 WHERE user_id IS NULL', t) USING owner_uid;
    EXECUTE format('ALTER TABLE %I ALTER COLUMN user_id SET NOT NULL', t);
  END LOOP;
END $$;

-- ── 3. RLS: recreate every ownership policy scoped TO authenticated ────────

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
    EXECUTE format('DROP POLICY IF EXISTS "own rows" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "own rows" ON %I FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
      t
    );
  END LOOP;
END $$;

-- ── 4. Storage: progress-photos goes private, reads via signed URLs ────────

UPDATE storage.buckets SET public = false WHERE id = 'progress-photos';

DROP POLICY IF EXISTS "own progress photos" ON storage.objects;
CREATE POLICY "own progress photos" ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ── 5. Pin search_path on the pre-existing rls_auto_enable event trigger fn ─

ALTER FUNCTION public.rls_auto_enable() SET search_path = '';
