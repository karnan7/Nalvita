-- pgTAP structural guards for the activity feed (KAR-45).
--
-- Asserts the invariants the feed relies on:
--   * audit_log stays append-only, for every role including the owner
--   * the two entry points are SECURITY DEFINER (they read across accounts)
--   * only `authenticated` can execute them; anon cannot
--   * no policy was added that lets anyone but the owner read a trail
--
-- Everything runs inside one transaction and rolls back.

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- Append-only ----------------------------------------------------------------

select ok(
  not has_table_privilege('authenticated', 'public.audit_log', 'UPDATE') and
  not has_table_privilege('authenticated', 'public.audit_log', 'DELETE'),
  'authenticated cannot update or delete audit_log entries');

select ok(
  not has_table_privilege('anon', 'public.audit_log', 'SELECT') and
  not has_table_privilege('anon', 'public.audit_log', 'INSERT'),
  'anon has no access to audit_log');

select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'audit_log'
     and cmd in ('UPDATE', 'DELETE')),
  0, 'no UPDATE or DELETE policy exists on audit_log');

select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'audit_log' and cmd = 'SELECT'),
  1, 'audit_log has exactly one SELECT policy (owner-only)');

-- Entry points are SECURITY DEFINER ------------------------------------------

select is(
  (select prosecdef from pg_proc
   where oid = 'public.log_audit_event(uuid, text, text, uuid)'::regprocedure),
  true, 'log_audit_event is SECURITY DEFINER');

select is(
  (select prosecdef from pg_proc
   where oid = 'public.list_audit_feed(int, timestamptz, bigint)'::regprocedure),
  true, 'list_audit_feed is SECURITY DEFINER');

-- A DEFINER function without a pinned search_path is a privilege-escalation
-- foothold; both must set it explicitly.
select ok(
  (select proconfig from pg_proc
   where oid = 'public.log_audit_event(uuid, text, text, uuid)'::regprocedure)
    @> array['search_path=""'] and
  (select proconfig from pg_proc
   where oid = 'public.list_audit_feed(int, timestamptz, bigint)'::regprocedure)
    @> array['search_path=""'],
  'both feed functions pin an empty search_path');

-- Execute privileges ---------------------------------------------------------

select ok(
  has_function_privilege('authenticated', 'public.log_audit_event(uuid, text, text, uuid)', 'EXECUTE') and
  has_function_privilege('authenticated', 'public.list_audit_feed(int, timestamptz, bigint)', 'EXECUTE'),
  'authenticated can execute the feed entry points');

select ok(
  not has_function_privilege('anon', 'public.log_audit_event(uuid, text, text, uuid)', 'EXECUTE') and
  not has_function_privilege('anon', 'public.list_audit_feed(int, timestamptz, bigint)', 'EXECUTE'),
  'anon cannot execute the feed entry points');

select * from finish();
rollback;
