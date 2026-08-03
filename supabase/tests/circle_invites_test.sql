-- pgTAP structural guards for Health Circle invites (KAR-44).
--
-- Asserts the invariants the invite mechanism relies on:
--   * RLS is enabled on the invites and rate-limit tables
--   * the invite_status enum matches @nalvita/core INVITE_STATUSES
--   * least-privilege grants: authenticated manages its own invites, but has
--     no access at all to the rate-limit table
--   * the lifecycle functions are SECURITY DEFINER (they read across owners)
--   * only the public entry points are executable by authenticated; the
--     internal helpers are not
--
-- Everything runs inside one transaction and rolls back.

begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- RLS enabled ----------------------------------------------------------------

select is(
  (select relrowsecurity from pg_class where oid = 'public.circle_invites'::regclass),
  true, 'RLS is enabled on circle_invites');

select is(
  (select relrowsecurity from pg_class where oid = 'public.circle_invite_attempts'::regclass),
  true, 'RLS is enabled on circle_invite_attempts');

-- Enum mirrors the constants -------------------------------------------------

select enum_has_labels(
  'public', 'invite_status',
  array['pending', 'accepted', 'declined', 'expired'],
  'invite_status enum matches INVITE_STATUSES');

-- Grants: least privilege ----------------------------------------------------

select ok(
  has_table_privilege('authenticated', 'public.circle_invites', 'SELECT') and
  has_table_privilege('authenticated', 'public.circle_invites', 'INSERT') and
  has_table_privilege('authenticated', 'public.circle_invites', 'UPDATE') and
  has_table_privilege('authenticated', 'public.circle_invites', 'DELETE'),
  'authenticated has full DML on circle_invites (RLS scopes the rows)');

select ok(
  not has_table_privilege('anon', 'public.circle_invites', 'SELECT'),
  'anon cannot SELECT circle_invites');

select ok(
  not has_table_privilege('authenticated', 'public.circle_invite_attempts', 'SELECT') and
  not has_table_privilege('authenticated', 'public.circle_invite_attempts', 'INSERT'),
  'authenticated has no direct access to the rate-limit table');

-- Lifecycle functions are SECURITY DEFINER -----------------------------------

select is(
  (select prosecdef from pg_proc where oid = 'public.accept_circle_invite(text)'::regprocedure),
  true, 'accept_circle_invite is SECURITY DEFINER');

select is(
  (select prosecdef from pg_proc where oid = 'public.preview_circle_invite(text)'::regprocedure),
  true, 'preview_circle_invite is SECURITY DEFINER');

select is(
  (select prosecdef from pg_proc where oid = 'public.decline_circle_invite(text)'::regprocedure),
  true, 'decline_circle_invite is SECURITY DEFINER');

select is(
  (select prosecdef from pg_proc where oid = 'public.list_circle_people()'::regprocedure),
  true, 'list_circle_people is SECURITY DEFINER');

-- Execute privileges: public entry points only -------------------------------

select ok(
  has_function_privilege('authenticated', 'public.accept_circle_invite(text)', 'EXECUTE') and
  has_function_privilege('authenticated', 'public.preview_circle_invite(text)', 'EXECUTE') and
  has_function_privilege('authenticated', 'public.decline_circle_invite(text)', 'EXECUTE'),
  'authenticated can execute the invite entry points');

select ok(
  not has_function_privilege('authenticated', 'public.resolve_circle_invite(text)', 'EXECUTE') and
  not has_function_privilege('authenticated', 'public.record_invite_failure()', 'EXECUTE'),
  'authenticated cannot execute the internal invite helpers');

select * from finish();
rollback;
