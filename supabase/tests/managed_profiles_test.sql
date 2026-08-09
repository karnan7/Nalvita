-- pgTAP structural guards for managed profiles and handover (KAR-53).
--
-- Asserts the invariants the feature rests on:
--   * profiles carries the child flag, and user_id is nullable so a profile can
--     exist without an account
--   * the cap is a trigger, not a hope
--   * RLS is on profile_claims, and the claim_status enum matches
--     @nalvita/core CLAIM_STATUSES
--   * least-privilege grants: no UPDATE on claims for authenticated, because
--     every status change belongs to one half of the handshake
--   * the lifecycle functions are SECURITY DEFINER, and only the public entry
--     points are executable
--
-- Everything runs inside one transaction and rolls back.

begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

-- profiles: a person need not be an account -----------------------------------

select col_is_null('public', 'profiles', 'user_id',
  'profiles.user_id is nullable, so a managed profile can exist without an account');

select has_column('public', 'profiles', 'is_minor', 'profiles records whether this is a child');

select col_not_null('public', 'profiles', 'is_minor',
  'is_minor is never unknown — it defaults to adult');

select has_column('public', 'profiles', 'managed_by', 'profiles names who operates it');

-- The cap is enforced by the database ----------------------------------------

select has_trigger('public', 'profiles', 'profiles_managed_cap',
  'the managed-profile cap is a trigger, not only a UI check');

select is(
  (select prosecdef from pg_proc where oid = 'public.enforce_managed_profile_cap()'::regprocedure),
  true, 'the cap counts every profile the account manages, not only visible ones');

-- profile_claims --------------------------------------------------------------

select is(
  (select relrowsecurity from pg_class where oid = 'public.profile_claims'::regclass),
  true, 'RLS is enabled on profile_claims');

select enum_has_labels(
  'public', 'claim_status',
  array['pending', 'awaiting_manager', 'completed', 'declined', 'expired'],
  'claim_status enum matches CLAIM_STATUSES');

-- Only one handover can be live for a profile at a time.
select has_index('public', 'profile_claims', 'profile_claims_one_live_per_profile',
  'a profile can have only one live claim');

-- Grants: least privilege -----------------------------------------------------

select ok(
  has_table_privilege('authenticated', 'public.profile_claims', 'SELECT') and
  has_table_privilege('authenticated', 'public.profile_claims', 'INSERT') and
  has_table_privilege('authenticated', 'public.profile_claims', 'DELETE'),
  'authenticated can start, see and withdraw its own claims (RLS scopes the rows)');

select ok(
  not has_table_privilege('authenticated', 'public.profile_claims', 'UPDATE'),
  'authenticated cannot UPDATE claims directly — status changes go through the functions');

select ok(
  not has_table_privilege('anon', 'public.profile_claims', 'SELECT'),
  'anon cannot SELECT profile_claims');

-- The handover runs as one privileged, atomic step ----------------------------

select is(
  (select prosecdef from pg_proc where oid = 'public.complete_profile_claim(uuid)'::regprocedure),
  true, 'complete_profile_claim is SECURITY DEFINER');

select ok(
  (select prosecdef from pg_proc where oid = 'public.accept_profile_claim(text)'::regprocedure) and
  (select prosecdef from pg_proc where oid = 'public.preview_profile_claim(text)'::regprocedure) and
  (select prosecdef from pg_proc where oid = 'public.decline_profile_claim(text)'::regprocedure) and
  (select prosecdef from pg_proc where oid = 'public.reject_profile_claim(uuid)'::regprocedure),
  'every claim lifecycle function is SECURITY DEFINER');

-- Execute privileges: public entry points only --------------------------------

select ok(
  has_function_privilege('authenticated', 'public.preview_profile_claim(text)', 'EXECUTE') and
  has_function_privilege('authenticated', 'public.accept_profile_claim(text)', 'EXECUTE') and
  has_function_privilege('authenticated', 'public.decline_profile_claim(text)', 'EXECUTE') and
  has_function_privilege('authenticated', 'public.complete_profile_claim(uuid)', 'EXECUTE') and
  has_function_privilege('authenticated', 'public.reject_profile_claim(uuid)', 'EXECUTE'),
  'authenticated can execute the claim entry points');

select ok(
  not has_function_privilege('authenticated', 'public.resolve_profile_claim(text)', 'EXECUTE') and
  not has_function_privilege('authenticated', 'public.count_profile_records(uuid)', 'EXECUTE'),
  'authenticated cannot execute the internal claim helpers');

select * from finish();
rollback;
