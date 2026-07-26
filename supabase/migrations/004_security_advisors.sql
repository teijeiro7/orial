-- ============================================================================
-- Orial — Security advisor cleanup after 003_supabase_auth
-- ============================================================================
-- Two WARN-level findings from mcp__supabase__get_advisors(type: "security"):
--
-- 1. `bump_updated_at` (added in 003) shipped without a pinned search_path,
--    same class of issue 002/003 already fixed on `rls_auto_enable`.
--
-- 2. `rls_auto_enable` is a DDL event-trigger helper, never meant to be
--    called directly, but SECURITY DEFINER + no REVOKE meant `anon` and
--    `authenticated` could invoke it via PostgREST's `/rpc/rls_auto_enable`.
--    Pre-existing (not introduced by 003), surfaced while touching this
--    function's search_path — revoking direct EXECUTE closes it.
-- ============================================================================

ALTER FUNCTION public.bump_updated_at() SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
