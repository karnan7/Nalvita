-- pgTAP structural and lifecycle guards (KAR-35). Run with: supabase test db
--
-- Complements roles_rls_test.sql with the invariants it does not assert:
--   * RLS is enabled on every public table
--   * Postgres enums match the constants in @nalvita/core
--   * the health-documents bucket is private with the documented limits
--   * table privileges match the least-privilege grants (KAR-42)
--   * memberships can be revoked but never deleted
--   * a pending membership grants no data access
--   * a revoked membership cannot be re-accepted
--   * an owner cannot forge a pre-accepted ('active') invite
--   * audit entries cannot be spoofed (actor_id) or written by strangers
--   * push tokens are private to their owner and delivery history is read-only
--
-- Everything runs inside one transaction and rolls back.

begin;
create extension if not exists pgtap with schema extensions;

select plan(34);

-- ---------------------------------------------------------------------------
-- RLS enabled on every public table
-- ---------------------------------------------------------------------------

select is(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  true, 'RLS is enabled on profiles');
select is(
  (select relrowsecurity from pg_class where oid = 'public.documents'::regclass),
  true, 'RLS is enabled on documents');
select is(
  (select relrowsecurity from pg_class where oid = 'public.medicines'::regclass),
  true, 'RLS is enabled on medicines');
select is(
  (select relrowsecurity from pg_class where oid = 'public.vitals'::regclass),
  true, 'RLS is enabled on vitals');
select is(
  (select relrowsecurity from pg_class where oid = 'public.allergies'::regclass),
  true, 'RLS is enabled on allergies');
select is(
  (select relrowsecurity from pg_class where oid = 'public.conditions'::regclass),
  true, 'RLS is enabled on conditions');
select is(
  (select relrowsecurity from pg_class where oid = 'public.doctors'::regclass),
  true, 'RLS is enabled on doctors');
select is(
  (select relrowsecurity from pg_class where oid = 'public.circle_memberships'::regclass),
  true, 'RLS is enabled on circle_memberships');
select is(
  (select relrowsecurity from pg_class where oid = 'public.audit_log'::regclass),
  true, 'RLS is enabled on audit_log');
select is(
  (select relrowsecurity from pg_class where oid = 'public.push_tokens'::regclass),
  true, 'RLS is enabled on push_tokens');
select is(
  (select relrowsecurity from pg_class where oid = 'public.notification_sends'::regclass),
  true, 'RLS is enabled on notification_sends');

-- ---------------------------------------------------------------------------
-- Enums mirror @nalvita/core constants (packages/core/src/constants.ts)
-- ---------------------------------------------------------------------------

select enum_has_labels(
  'public', 'blood_group',
  array['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  'blood_group enum matches BLOOD_GROUPS');

select enum_has_labels(
  'public', 'circle_role',
  array['viewer', 'caregiver', 'manager'],
  'circle_role enum matches CIRCLE_ROLES');

select enum_has_labels(
  'public', 'membership_status',
  array['pending', 'active', 'revoked'],
  'membership_status enum matches MEMBERSHIP_STATUSES');

-- ---------------------------------------------------------------------------
-- Storage bucket: private, 20 MB, PDF/JPEG/PNG only
-- ---------------------------------------------------------------------------

select is(
  (select public from storage.buckets where id = 'health-documents'),
  false, 'health-documents bucket is private');

select is(
  (select file_size_limit from storage.buckets where id = 'health-documents'),
  (20 * 1024 * 1024)::bigint, 'health-documents bucket enforces the 20 MB limit');

select is(
  (select allowed_mime_types from storage.buckets where id = 'health-documents'),
  array['application/pdf', 'image/jpeg', 'image/png'],
  'health-documents bucket allows only the documented MIME types');

-- ---------------------------------------------------------------------------
-- Table privileges (KAR-42): least privilege beneath RLS
-- ---------------------------------------------------------------------------

select ok(
  (select bool_and(
     has_table_privilege('authenticated', format('public.%I', t), 'SELECT') and
     has_table_privilege('authenticated', format('public.%I', t), 'INSERT') and
     has_table_privilege('authenticated', format('public.%I', t), 'UPDATE') and
     has_table_privilege('authenticated', format('public.%I', t), 'DELETE'))
   from unnest(array['profiles', 'documents', 'medicines', 'vitals',
                     'allergies', 'conditions', 'doctors']) as t),
  'authenticated has full DML on every health table (RLS gates the rows)');

select ok(
  not has_table_privilege('authenticated', 'public.circle_memberships', 'DELETE'),
  'authenticated cannot DELETE memberships even at the privilege level');

select ok(
  not has_table_privilege('authenticated', 'public.audit_log', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.audit_log', 'DELETE'),
  'authenticated cannot UPDATE or DELETE audit_log at the privilege level');

select ok(
  (select bool_and(not has_table_privilege('anon', format('public.%I', t), 'SELECT'))
   from unnest(array['profiles', 'documents', 'medicines', 'vitals', 'allergies',
                     'conditions', 'doctors', 'circle_memberships', 'audit_log',
                     'push_tokens', 'notification_sends']) as t),
  'anon cannot SELECT from any table');

-- Delivery history is written only by the send function running as
-- service_role. The app reads its own counts and can do nothing else to them.
select ok(
  not has_table_privilege('authenticated', 'public.notification_sends', 'INSERT')
  and not has_table_privilege('authenticated', 'public.notification_sends', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.notification_sends', 'DELETE'),
  'authenticated can only read notification_sends');

-- A device is the user's own to register and remove from the app.
select ok(
  has_table_privilege('authenticated', 'public.push_tokens', 'SELECT')
  and has_table_privilege('authenticated', 'public.push_tokens', 'INSERT')
  and has_table_privilege('authenticated', 'public.push_tokens', 'DELETE'),
  'authenticated manages its own push_tokens rows');

-- ---------------------------------------------------------------------------
-- Impersonation helper (same mechanism PostgREST uses)
-- ---------------------------------------------------------------------------

create function pg_temp.impersonate(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text,
    true
  );
  perform set_config('role', 'authenticated', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Seed: owner, member (pending viewer invite), stranger
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
  u.email, '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', ''
from (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'owner@test.local'),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'member@test.local'),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'stranger@test.local')
) as u (id, email);

-- Records hang off the profile the signup trigger just created. Pinned here,
-- while still superuser: later statements run as impersonated roles that RLS
-- would stop from reading the profiles row.
select set_config('test.owner_profile', (select id from public.profiles where user_id = '11111111-1111-1111-1111-111111111111')::text, true);

-- Records hang off the profile the signup trigger just created.
insert into public.vitals (profile_id, type, value_1, unit, measured_at)
values ((select id from public.profiles where user_id = '11111111-1111-1111-1111-111111111111'), 'weight', 72.5, 'kg', now());

insert into public.circle_memberships (owner_id, member_id, role, shared_categories, status)
values ((select id from public.profiles where user_id = '11111111-1111-1111-1111-111111111111'), '22222222-2222-2222-2222-222222222222',
        'viewer', '{all}', 'pending');

-- ---------------------------------------------------------------------------
-- Pending membership grants no data access
-- ---------------------------------------------------------------------------

select pg_temp.impersonate('22222222-2222-2222-2222-222222222222');

select is(
  (select count(*) from public.vitals),
  0::bigint,
  'a pending member sees no owner data');

-- ---------------------------------------------------------------------------
-- Owner cannot forge a pre-accepted invite
-- ---------------------------------------------------------------------------

select pg_temp.impersonate('11111111-1111-1111-1111-111111111111');

select throws_ok(
  $$insert into public.circle_memberships (owner_id, member_id, role, shared_categories, status, accepted_at)
    values ('11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555',
            'manager', '{all}', 'active', now())$$,
  '42501', null,
  'owner cannot insert an invite that is already active');

-- ---------------------------------------------------------------------------
-- Memberships are revoked, never deleted
-- ---------------------------------------------------------------------------

select pg_temp.impersonate('22222222-2222-2222-2222-222222222222');

select lives_ok(
  $$update public.circle_memberships set status = 'active'
    where owner_id = current_setting('test.owner_profile')::uuid
      and member_id = '22222222-2222-2222-2222-222222222222'$$,
  'member can accept the pending invite');

select throws_ok(
  $$delete from public.circle_memberships
    where member_id = '22222222-2222-2222-2222-222222222222'$$,
  '42501', null,
  'member cannot delete a membership');

select pg_temp.impersonate('11111111-1111-1111-1111-111111111111');

select throws_ok(
  $$delete from public.circle_memberships
    where owner_id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', null,
  'owner cannot delete a membership either — revoked, never deleted');

-- ---------------------------------------------------------------------------
-- A revoked membership cannot be re-accepted
-- ---------------------------------------------------------------------------

select lives_ok(
  $$update public.circle_memberships set status = 'revoked'
    where owner_id = current_setting('test.owner_profile')::uuid
      and member_id = '22222222-2222-2222-2222-222222222222'$$,
  'owner can revoke the membership');

select pg_temp.impersonate('22222222-2222-2222-2222-222222222222');

select throws_ok(
  $$update public.circle_memberships set status = 'active'
    where owner_id = current_setting('test.owner_profile')::uuid
      and member_id = '22222222-2222-2222-2222-222222222222'$$,
  'P0001', null,
  'a revoked member cannot re-accept the invite');

-- ---------------------------------------------------------------------------
-- Audit log: no spoofing, no stranger entries
-- ---------------------------------------------------------------------------

select pg_temp.impersonate('11111111-1111-1111-1111-111111111111');

select throws_ok(
  $$insert into public.audit_log (actor_id, owner_id, action, resource_type)
    values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
            'added_vital', 'vitals')$$,
  '42501', null,
  'audit entries cannot be written as another actor');

select pg_temp.impersonate('55555555-5555-5555-5555-555555555555');

select throws_ok(
  $$insert into public.audit_log (actor_id, owner_id, action, resource_type)
    values ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111',
            'viewed_document', 'documents')$$,
  '42501', null,
  'a user without circle access cannot append audit entries about an owner');

-- ---------------------------------------------------------------------------
-- Push tokens: private to the account that registered them (KAR-52)
--
-- A caregiver may read their relative's medicines. Enumerating the devices
-- that relative owns is a different thing entirely, and nothing grants it —
-- the send path runs as service_role and looks tokens up itself.
-- ---------------------------------------------------------------------------

select pg_temp.impersonate('11111111-1111-1111-1111-111111111111');

insert into public.push_tokens (user_id, token, platform, device_label)
values ('11111111-1111-1111-1111-111111111111', 'ExponentPushToken[owner-device]', 'android', 'Pixel');

select pg_temp.impersonate('22222222-2222-2222-2222-222222222222');

select is(
  (select count(*) from public.push_tokens
    where token = 'ExponentPushToken[owner-device]'),
  0::bigint,
  'a circle member cannot see the devices belonging to the account they help');

select throws_ok(
  $$insert into public.push_tokens (user_id, token, platform)
    values ('11111111-1111-1111-1111-111111111111', 'ExponentPushToken[forged]', 'ios')$$,
  '42501', null,
  'a device cannot be registered against somebody else''s account');

select * from finish();
rollback;
