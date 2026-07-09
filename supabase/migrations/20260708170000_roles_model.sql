-- Roles model (KAR-33, follow-up to the KAR-30 foundation).
-- Adds Health Circle memberships, the has_circle_access() RLS helper, and an
-- append-only audit log, then rewrites every health-table policy to grant
-- access to the owner OR an active circle member with sufficient role.
--
-- With zero circle_memberships rows, behavior is identical to the owner-only
-- policies this migration replaces.
--
-- Role model:
--   viewer    — read-only, limited to shared categories
--   caregiver — viewer + add records on behalf, log vitals, manage medicines
--   manager   — full operation of a managed profile, including deletes
--
-- Categories in shared_categories are the health table names ('documents',
-- 'medicines', 'vitals', 'allergies', 'conditions', 'doctors', 'profiles'),
-- or 'all' as a wildcard.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.circle_role as enum ('viewer', 'caregiver', 'manager');
create type public.membership_status as enum ('pending', 'active', 'revoked');

-- ---------------------------------------------------------------------------
-- circle_memberships
-- ---------------------------------------------------------------------------

create table public.circle_memberships (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid not null references auth.users (id) on delete cascade,
  role public.circle_role not null default 'viewer',
  shared_categories text[] not null default '{all}',
  status public.membership_status not null default 'pending',
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  constraint no_self_membership check (owner_id <> member_id),
  constraint unique_pair unique (owner_id, member_id)
);

-- has_circle_access() looks up by (member_id, status) on every policy check.
create index circle_memberships_member_id_status_idx
  on public.circle_memberships (member_id, status);

-- ---------------------------------------------------------------------------
-- RLS helper
-- ---------------------------------------------------------------------------

create or replace function public.has_circle_access(
  p_owner uuid,
  p_min_role public.circle_role,
  p_category text
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.circle_memberships m
    where m.owner_id = p_owner
      and m.member_id = (select auth.uid())
      and m.status = 'active'
      and (m.shared_categories @> array['all'] or m.shared_categories @> array[p_category])
      and case p_min_role
            when 'viewer' then m.role in ('viewer', 'caregiver', 'manager')
            when 'caregiver' then m.role in ('caregiver', 'manager')
            when 'manager' then m.role = 'manager'
          end
  );
$$;

revoke execute on function public.has_circle_access(uuid, public.circle_role, text) from public, anon;
grant execute on function public.has_circle_access(uuid, public.circle_role, text) to authenticated;

-- ---------------------------------------------------------------------------
-- circle_memberships RLS
-- Owner and member can read their rows; only the owner can insert (invite)
-- and revoke; the member can accept (pending -> active). No delete policy:
-- memberships are revoked, never deleted, so the record survives as history.
-- ---------------------------------------------------------------------------

alter table public.circle_memberships enable row level security;

create policy "Owner and member can view memberships" on public.circle_memberships
  for select to authenticated
  using ((select auth.uid()) in (owner_id, member_id));

create policy "Owner can invite members" on public.circle_memberships
  for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and status = 'pending'
    and accepted_at is null
    and revoked_at is null
  );

create policy "Owner can update own memberships" on public.circle_memberships
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Member can respond to invites" on public.circle_memberships
  for update to authenticated
  using ((select auth.uid()) = member_id)
  with check ((select auth.uid()) = member_id);

-- RLS cannot compare OLD and NEW, so legal state transitions are enforced in
-- a trigger: the member may only accept a pending invite (without touching
-- role or categories), and the owner may only move status to 'revoked'.
create or replace function public.enforce_membership_transition()
returns trigger
language plpgsql
as $$
declare
  actor uuid := (select auth.uid());
begin
  if new.owner_id <> old.owner_id or new.member_id <> old.member_id then
    raise exception 'membership parties cannot be changed';
  end if;

  if actor = old.member_id then
    if old.status <> 'pending' or new.status <> 'active'
       or new.role <> old.role
       or new.shared_categories <> old.shared_categories then
      raise exception 'member can only accept a pending invite';
    end if;
    new.accepted_at := coalesce(new.accepted_at, now());
  elsif actor = old.owner_id then
    if new.status <> old.status then
      if new.status <> 'revoked' then
        raise exception 'owner can only change status to revoked';
      end if;
      new.revoked_at := coalesce(new.revoked_at, now());
    end if;
  end if;

  return new;
end;
$$;

create trigger circle_memberships_enforce_transition
  before update on public.circle_memberships
  for each row execute function public.enforce_membership_transition();

-- ---------------------------------------------------------------------------
-- audit_log (append-only)
-- Owner can read their own audit trail; any authenticated user can append
-- entries about data they can at least view, always as themselves. Nobody —
-- including the owner — can update or delete rows.
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  owner_id uuid not null,
  action text not null,        -- 'viewed_document', 'added_vital', ...
  resource_type text not null, -- health table name, matches share categories
  resource_id uuid,
  created_at timestamptz not null default now()
);

create index audit_log_owner_id_created_at_idx
  on public.audit_log (owner_id, created_at desc);

alter table public.audit_log enable row level security;

create policy "Owner can view own audit log" on public.audit_log
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Actors can append audit entries" on public.audit_log
  for insert to authenticated
  with check (
    (select auth.uid()) = actor_id
    and (
      owner_id = (select auth.uid())
      or public.has_circle_access(owner_id, 'viewer', resource_type)
    )
  );

-- Belt and braces: no update/delete policies exist, and the privileges are
-- revoked outright so the table is append-only even if a policy is added by
-- mistake later.
revoke update, delete on public.audit_log from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Health-table RLS: owner OR circle access
-- SELECT needs viewer, INSERT/UPDATE need caregiver, DELETE needs manager.
-- ---------------------------------------------------------------------------

-- profiles ------------------------------------------------------------------

drop policy "Users can view own profile" on public.profiles;
drop policy "Users can insert own profile" on public.profiles;
drop policy "Users can update own profile" on public.profiles;
drop policy "Users can delete own profile" on public.profiles;

create policy "Owner or circle can view profile" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'viewer', 'profiles'));
create policy "Owner or circle can insert profile" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'caregiver', 'profiles'));
create policy "Owner or circle can update profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'caregiver', 'profiles'))
  with check ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'caregiver', 'profiles'));
create policy "Owner or circle can delete profile" on public.profiles
  for delete to authenticated
  using ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'manager', 'profiles'));

-- documents -----------------------------------------------------------------

drop policy "Users can view own documents" on public.documents;
drop policy "Users can insert own documents" on public.documents;
drop policy "Users can update own documents" on public.documents;
drop policy "Users can delete own documents" on public.documents;

create policy "Owner or circle can view documents" on public.documents
  for select to authenticated
  using ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'viewer', 'documents'));
create policy "Owner or circle can insert documents" on public.documents
  for insert to authenticated
  with check ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'caregiver', 'documents'));
create policy "Owner or circle can update documents" on public.documents
  for update to authenticated
  using ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'caregiver', 'documents'))
  with check ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'caregiver', 'documents'));
create policy "Owner or circle can delete documents" on public.documents
  for delete to authenticated
  using ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'manager', 'documents'));

-- medicines -----------------------------------------------------------------

drop policy "Users can view own medicines" on public.medicines;
drop policy "Users can insert own medicines" on public.medicines;
drop policy "Users can update own medicines" on public.medicines;
drop policy "Users can delete own medicines" on public.medicines;

create policy "Owner or circle can view medicines" on public.medicines
  for select to authenticated
  using ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'viewer', 'medicines'));
create policy "Owner or circle can insert medicines" on public.medicines
  for insert to authenticated
  with check ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'caregiver', 'medicines'));
create policy "Owner or circle can update medicines" on public.medicines
  for update to authenticated
  using ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'caregiver', 'medicines'))
  with check ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'caregiver', 'medicines'));
create policy "Owner or circle can delete medicines" on public.medicines
  for delete to authenticated
  using ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'manager', 'medicines'));

-- vitals --------------------------------------------------------------------

drop policy "Users can view own vitals" on public.vitals;
drop policy "Users can insert own vitals" on public.vitals;
drop policy "Users can update own vitals" on public.vitals;
drop policy "Users can delete own vitals" on public.vitals;

create policy "Owner or circle can view vitals" on public.vitals
  for select to authenticated
  using ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'viewer', 'vitals'));
create policy "Owner or circle can insert vitals" on public.vitals
  for insert to authenticated
  with check ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'caregiver', 'vitals'));
create policy "Owner or circle can update vitals" on public.vitals
  for update to authenticated
  using ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'caregiver', 'vitals'))
  with check ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'caregiver', 'vitals'));
create policy "Owner or circle can delete vitals" on public.vitals
  for delete to authenticated
  using ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'manager', 'vitals'));

-- allergies -----------------------------------------------------------------

drop policy "Users can view own allergies" on public.allergies;
drop policy "Users can insert own allergies" on public.allergies;
drop policy "Users can update own allergies" on public.allergies;
drop policy "Users can delete own allergies" on public.allergies;

create policy "Owner or circle can view allergies" on public.allergies
  for select to authenticated
  using ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'viewer', 'allergies'));
create policy "Owner or circle can insert allergies" on public.allergies
  for insert to authenticated
  with check ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'caregiver', 'allergies'));
create policy "Owner or circle can update allergies" on public.allergies
  for update to authenticated
  using ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'caregiver', 'allergies'))
  with check ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'caregiver', 'allergies'));
create policy "Owner or circle can delete allergies" on public.allergies
  for delete to authenticated
  using ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'manager', 'allergies'));

-- conditions ----------------------------------------------------------------

drop policy "Users can view own conditions" on public.conditions;
drop policy "Users can insert own conditions" on public.conditions;
drop policy "Users can update own conditions" on public.conditions;
drop policy "Users can delete own conditions" on public.conditions;

create policy "Owner or circle can view conditions" on public.conditions
  for select to authenticated
  using ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'viewer', 'conditions'));
create policy "Owner or circle can insert conditions" on public.conditions
  for insert to authenticated
  with check ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'caregiver', 'conditions'));
create policy "Owner or circle can update conditions" on public.conditions
  for update to authenticated
  using ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'caregiver', 'conditions'))
  with check ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'caregiver', 'conditions'));
create policy "Owner or circle can delete conditions" on public.conditions
  for delete to authenticated
  using ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'manager', 'conditions'));

-- doctors -------------------------------------------------------------------

drop policy "Users can view own doctors" on public.doctors;
drop policy "Users can insert own doctors" on public.doctors;
drop policy "Users can update own doctors" on public.doctors;
drop policy "Users can delete own doctors" on public.doctors;

create policy "Owner or circle can view doctors" on public.doctors
  for select to authenticated
  using ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'viewer', 'doctors'));
create policy "Owner or circle can insert doctors" on public.doctors
  for insert to authenticated
  with check ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'caregiver', 'doctors'));
create policy "Owner or circle can update doctors" on public.doctors
  for update to authenticated
  using ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'caregiver', 'doctors'))
  with check ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'caregiver', 'doctors'));
create policy "Owner or circle can delete doctors" on public.doctors
  for delete to authenticated
  using ((select auth.uid()) = user_id or public.has_circle_access(user_id, 'manager', 'doctors'));

-- ---------------------------------------------------------------------------
-- Platform admin — verified explicitly (KAR-33 acceptance criterion)
--
-- No policy in this migration (or anywhere in this schema) grants any role
-- other than `authenticated` access to health tables, and every policy above
-- is scoped to auth.uid() — the owner or an active circle member. There is
-- deliberately NO platform-admin/support policy on health records: support
-- tooling operates on account metadata only. The pgTAP suite in
-- supabase/tests/roles_rls_test.sql asserts this against pg_policies.
-- ---------------------------------------------------------------------------
