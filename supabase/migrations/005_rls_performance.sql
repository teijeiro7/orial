-- ============================================================================
-- Orial — RLS initplan performance fix
-- ============================================================================
-- mcp__supabase__get_advisors(type: "performance") flagged all 30 "own rows"
-- policies (introduced by 002, recreated as-is by 003): `auth.uid()` gets
-- re-evaluated once per row instead of once per query. Wrapping it as
-- `(select auth.uid())` lets Postgres treat it as a stable subquery,
-- evaluated once — same predicate, same security semantics, no behavior
-- change, just faster at scale. See:
-- https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- ============================================================================

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
      'CREATE POLICY "own rows" ON %I FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id)',
      t
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "own progress photos" ON storage.objects;
CREATE POLICY "own progress photos" ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = (select auth.uid())::text)
  WITH CHECK (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = (select auth.uid())::text);
