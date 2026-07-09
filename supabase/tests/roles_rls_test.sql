-- pgTAP suite for the KAR-33 roles model. Run with: supabase test db
--
-- Demonstrates, per the acceptance criteria:
--   * viewer can read the shared category only
--   * caregiver can insert on behalf of the owner but not delete
--   * manager can delete
--   * a revoked member loses access immediately
--   * no policy grants health-record access to any role except `authenticated`
--   * audit_log is append-only
--
-- Everything runs inside one transaction and rolls back, so the suite is
-- repeatable and leaves no data behind.

begin;
create extension if not exists pgtap with schema extensions;

select plan(21);

-- ---------------------------------------------------------------------------
-- Impersonation helper: switch the current user the way PostgREST would.
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
-- Seed: five users, the owner's data, and two pre-accepted memberships.
-- The viewer membership is created through RLS below to exercise the
-- invite -> accept flow.
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
    ('22222222-2222-2222-2222-222222222222'::uuid, 'viewer@test.local'),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'caregiver@test.local'),
    ('44444444-4444-4444-4444-444444444444'::uuid, 'manager@test.local'),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'stranger@test.local')
) as u (id, email);

insert into public.documents (id, user_id, title, category, file_path, file_type, file_size)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'CBC report', 'lab_report',
  '11111111-1111-1111-1111-111111111111/cbc.pdf', 'application/pdf', 1000
);

insert into public.vitals (user_id, type, value_1, unit, measured_at)
values ('11111111-1111-1111-1111-111111111111', 'weight', 72.5, 'kg', now());

insert into public.medicines (user_id, name, dosage, frequency, start_date)
values ('11111111-1111-1111-1111-111111111111', 'Metformin', '500mg', 'twice_daily', current_date);

insert into public.circle_memberships (owner_id, member_id, role, shared_categories, status, accepted_at)
values
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
   'caregiver', '{all}', 'active', now()),
  ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444',
   'manager', '{all}', 'active', now());

-- ---------------------------------------------------------------------------
-- Invite -> accept flow (viewer, shared category: vitals only)
-- ---------------------------------------------------------------------------

select pg_temp.impersonate('11111111-1111-1111-1111-111111111111');

select lives_ok(
  $$insert into public.circle_memberships (owner_id, member_id, role, shared_categories)
    values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
            'viewer', '{vitals}')$$,
  'owner can invite a member'
);

select pg_temp.impersonate('22222222-2222-2222-2222-222222222222');

select lives_ok(
  $$update public.circle_memberships set status = 'active'
    where owner_id = '11111111-1111-1111-1111-111111111111'
      and member_id = '22222222-2222-2222-2222-222222222222'$$,
  'member can accept a pending invite'
);

select throws_ok(
  $$update public.circle_memberships set role = 'manager'
    where owner_id = '11111111-1111-1111-1111-111111111111'
      and member_id = '22222222-2222-2222-2222-222222222222'$$,
  'P0001', null,
  'member cannot escalate their own role'
);

-- ---------------------------------------------------------------------------
-- Viewer: read-only, shared categories only
-- ---------------------------------------------------------------------------

select is(
  (select count(*) from public.vitals),
  1::bigint,
  'viewer can read the shared category (vitals)'
);

select is(
  (select count(*) from public.documents),
  0::bigint,
  'viewer cannot read an unshared category (documents)'
);

select is(
  (select count(*) from public.profiles
   where user_id = '11111111-1111-1111-1111-111111111111'),
  0::bigint,
  'viewer cannot read the owner profile (profiles not shared)'
);

select throws_ok(
  $$insert into public.vitals (user_id, type, value_1, unit, measured_at)
    values ('11111111-1111-1111-1111-111111111111', 'weight', 70, 'kg', now())$$,
  '42501', null,
  'viewer cannot insert even in the shared category'
);

delete from public.vitals where user_id = '11111111-1111-1111-1111-111111111111';

select is(
  (select count(*) from public.vitals),
  1::bigint,
  'viewer delete is filtered by RLS (vital still present)'
);

-- ---------------------------------------------------------------------------
-- Caregiver: can add on behalf, cannot delete
-- ---------------------------------------------------------------------------

select pg_temp.impersonate('33333333-3333-3333-3333-333333333333');

select is(
  (select count(*) from public.documents),
  1::bigint,
  'caregiver with {all} can read documents'
);

select lives_ok(
  $$insert into public.medicines (user_id, name, dosage, frequency, start_date)
    values ('11111111-1111-1111-1111-111111111111', 'Amlodipine', '5mg', 'once_daily', current_date)$$,
  'caregiver can insert a medicine on behalf of the owner'
);

select pg_temp.impersonate('11111111-1111-1111-1111-111111111111');

select is(
  (select count(*) from public.medicines),
  2::bigint,
  'the caregiver-added medicine belongs to the owner'
);

select pg_temp.impersonate('33333333-3333-3333-3333-333333333333');

delete from public.documents where user_id = '11111111-1111-1111-1111-111111111111';

select is(
  (select count(*) from public.documents),
  1::bigint,
  'caregiver delete is filtered by RLS (document still present)'
);

-- ---------------------------------------------------------------------------
-- Manager: full operation including deletes
-- ---------------------------------------------------------------------------

select pg_temp.impersonate('44444444-4444-4444-4444-444444444444');

delete from public.documents where user_id = '11111111-1111-1111-1111-111111111111';

select is(
  (select count(*) from public.documents),
  0::bigint,
  'manager can delete the owner document'
);

-- ---------------------------------------------------------------------------
-- Revocation: access is lost immediately
-- ---------------------------------------------------------------------------

select pg_temp.impersonate('11111111-1111-1111-1111-111111111111');

select lives_ok(
  $$update public.circle_memberships set status = 'revoked'
    where owner_id = '11111111-1111-1111-1111-111111111111'
      and member_id = '22222222-2222-2222-2222-222222222222'$$,
  'owner can revoke a membership'
);

select pg_temp.impersonate('22222222-2222-2222-2222-222222222222');

select is(
  (select count(*) from public.vitals),
  0::bigint,
  'revoked member loses access immediately'
);

select pg_temp.impersonate('55555555-5555-5555-5555-555555555555');

select is(
  (select count(*) from public.vitals),
  0::bigint,
  'a user with no membership sees nothing'
);

-- ---------------------------------------------------------------------------
-- Platform admin: no policy grants health access beyond `authenticated`
-- ---------------------------------------------------------------------------

reset role;

select is(
  (select count(*) from pg_policies
   where schemaname = 'public'
     and tablename in ('profiles', 'documents', 'medicines', 'vitals',
                       'allergies', 'conditions', 'doctors')
     and roles <> '{authenticated}'::name[]),
  0::bigint,
  'no health-table policy applies to any role other than authenticated'
);

-- ---------------------------------------------------------------------------
-- Audit log: append-only
-- ---------------------------------------------------------------------------

select pg_temp.impersonate('11111111-1111-1111-1111-111111111111');

select lives_ok(
  $$insert into public.audit_log (actor_id, owner_id, action, resource_type)
    values ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
            'added_vital', 'vitals')$$,
  'owner can append to their own audit log'
);

select pg_temp.impersonate('33333333-3333-3333-3333-333333333333');

select lives_ok(
  $$insert into public.audit_log (actor_id, owner_id, action, resource_type)
    values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
            'added_medicine', 'medicines')$$,
  'circle member can append audit entries about the owner'
);

select pg_temp.impersonate('11111111-1111-1111-1111-111111111111');

select throws_ok(
  $$update public.audit_log set action = 'tampered'$$,
  '42501', null,
  'audit log rows cannot be updated'
);

select throws_ok(
  $$delete from public.audit_log$$,
  '42501', null,
  'audit log rows cannot be deleted'
);

select * from finish();
rollback;
