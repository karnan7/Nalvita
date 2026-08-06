-- Profile-based ownership (KAR-48, part 1 of 2).
--
-- Health records have keyed on `user_id -> auth.users` since the initial
-- schema. That makes a person and an account the same thing, which blocks the
-- story this prepares for: an elderly parent who will never install the app but
-- whose records still need to live somewhere, in her name.
--
-- So the subject of a record becomes a *profile* rather than an account:
--
--   profiles.user_id    now nullable — a managed profile has no account (yet)
--   profiles.managed_by who operates it while it has no account of its own
--   <health>.profile_id replaces <health>.user_id
--
-- A self-managed person is unchanged in every observable way: their profile
-- carries their user_id, and with zero circle_memberships rows the policies
-- below grant exactly what the owner-only policies granted before.
--
-- This migration deliberately contains no feature work — creating and operating
-- managed profiles, and the claim/handover flow, come next. It exists on its
-- own so the ownership change can be reviewed and tested in isolation.
--
-- Destructive by necessity (six columns are dropped and three change meaning);
-- signed off before it was written.

-- ---------------------------------------------------------------------------
-- profiles: a person, with or without an account
-- ---------------------------------------------------------------------------

alter table public.profiles
  alter column user_id drop not null,
  add column managed_by uuid references auth.users (id) on delete cascade;

-- Every profile is reachable by someone: it either has its own account or
-- somebody manages it. Both at once is legal only in the moment of handover.
alter table public.profiles
  add constraint profile_has_an_owner
  check (user_id is not null or managed_by is not null);

create index profiles_managed_by_idx on public.profiles (managed_by);

-- ---------------------------------------------------------------------------
-- The caller's own profile.
--
-- Policies need it on every row check, so it is STABLE (evaluated once per
-- statement) and SECURITY DEFINER (a policy on profiles cannot read profiles
-- to decide access to profiles).
-- ---------------------------------------------------------------------------

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p where p.user_id = (select auth.uid());
$$;

revoke execute on function public.current_profile_id() from public, anon;
grant execute on function public.current_profile_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Clear the way.
--
-- Every policy below names a column this migration is about to change, and
-- Postgres will not drop a column a policy depends on. They are all recreated
-- against the new key further down; nothing is left unprotected, because the
-- whole migration runs in one transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  v text;
begin
  foreach t in array array['documents', 'medicines', 'vitals', 'allergies', 'conditions', 'doctors']
  loop
    foreach v in array array['view', 'insert', 'update', 'delete']
    loop
      execute format('drop policy %I on public.%I', format('Owner or circle can %s %s', v, t), t);
    end loop;
  end loop;
end;
$$;

drop policy "Owner or circle can view profile" on public.profiles;
drop policy "Owner or circle can insert profile" on public.profiles;
drop policy "Owner or circle can update profile" on public.profiles;
drop policy "Owner or circle can delete profile" on public.profiles;

drop policy "Owner and member can view memberships" on public.circle_memberships;
drop policy "Owner can invite members" on public.circle_memberships;
drop policy "Owner can update own memberships" on public.circle_memberships;
drop policy "Member can respond to invites" on public.circle_memberships;

drop policy "Owner can view own invites" on public.circle_invites;
drop policy "Owner can create invites" on public.circle_invites;
drop policy "Owner can update own invites" on public.circle_invites;
drop policy "Owner can delete own invites" on public.circle_invites;

drop policy "Owner can view own audit log" on public.audit_log;
drop policy "Actors can append audit entries" on public.audit_log;

drop policy "Owner or circle can view health documents" on storage.objects;
drop policy "Owner or circle can upload health documents" on storage.objects;
drop policy "Owner or circle can update health documents" on storage.objects;
drop policy "Owner or circle can delete health documents" on storage.objects;

-- ---------------------------------------------------------------------------
-- Re-key the health tables.
--
-- Each gains profile_id, backfilled through the profile that carries the old
-- user_id, before the old column goes. Doing it in this order means the data
-- moves with the schema and nothing has to be re-imported.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['documents', 'medicines', 'vitals', 'allergies', 'conditions', 'doctors']
  loop
    execute format('alter table public.%I add column profile_id uuid', t);
    execute format(
      'update public.%I r set profile_id = p.id from public.profiles p where p.user_id = r.user_id', t);
    execute format('alter table public.%I alter column profile_id set not null', t);
    execute format(
      'alter table public.%I add constraint %I foreign key (profile_id) '
      'references public.profiles (id) on delete cascade', t, t || '_profile_id_fkey');
    execute format('create index %I on public.%I (profile_id)', t || '_profile_id_idx', t);
    execute format('alter table public.%I drop column user_id', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- circle_memberships: the owner is now a profile, so a managed profile can be
-- shared exactly like any other. The member is still an account — only a real
-- person can be granted access.
-- ---------------------------------------------------------------------------

alter table public.circle_memberships add column owner_profile_id uuid;

update public.circle_memberships m
  set owner_profile_id = p.id
  from public.profiles p
  where p.user_id = m.owner_id;

alter table public.circle_memberships
  drop constraint no_self_membership,
  drop constraint unique_pair,
  drop column owner_id;

alter table public.circle_memberships
  rename column owner_profile_id to owner_id;

alter table public.circle_memberships
  alter column owner_id set not null,
  add constraint circle_memberships_owner_id_fkey
    foreign key (owner_id) references public.profiles (id) on delete cascade,
  add constraint unique_pair unique (owner_id, member_id);

-- Self-membership is now "the member already owns this profile", which only the
-- profiles row can answer. That needs a lookup, so it is a trigger rather than
-- a CHECK constraint — Postgres permits a non-immutable function in a CHECK but
-- never re-evaluates it, which would make the rule quietly untrue over time.
create or replace function public.owns_profile(p_profile uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_profile and (p.user_id = p_user or p.managed_by = p_user)
  );
$$;

revoke execute on function public.owns_profile(uuid, uuid) from public, anon;
grant execute on function public.owns_profile(uuid, uuid) to authenticated;

create or replace function public.reject_self_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.owns_profile(new.owner_id, new.member_id) then
    raise exception 'A person cannot be a member of their own profile.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger circle_memberships_reject_self
  before insert or update on public.circle_memberships
  for each row execute function public.reject_self_membership();

-- ---------------------------------------------------------------------------
-- circle_invites and audit_log follow the same move.
-- ---------------------------------------------------------------------------

alter table public.circle_invites add column owner_profile_id uuid;
update public.circle_invites i
  set owner_profile_id = p.id from public.profiles p where p.user_id = i.owner_id;
alter table public.circle_invites drop column owner_id;
alter table public.circle_invites rename column owner_profile_id to owner_id;
alter table public.circle_invites
  alter column owner_id set not null,
  add constraint circle_invites_owner_id_fkey
    foreign key (owner_id) references public.profiles (id) on delete cascade;

drop index if exists public.circle_invites_one_pending_per_email;
create unique index circle_invites_one_pending_per_email
  on public.circle_invites (owner_id, lower(invitee_email))
  where status = 'pending' and invitee_email is not null;

alter table public.audit_log add column owner_profile_id uuid;
update public.audit_log a
  set owner_profile_id = p.id from public.profiles p where p.user_id = a.owner_id;
-- Entries whose owner no longer resolves are history about a deleted account;
-- they cannot be attributed to a profile, so they go with it.
delete from public.audit_log where owner_profile_id is null;
alter table public.audit_log drop column owner_id;
alter table public.audit_log rename column owner_profile_id to owner_id;
alter table public.audit_log alter column owner_id set not null;

drop index if exists public.audit_log_owner_id_created_at_idx;
create index audit_log_owner_id_created_at_idx
  on public.audit_log (owner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- has_circle_access, now asking about a profile.
--
-- Access to a profile is: I am it, I manage it, or I am an active circle member
-- of it with a sufficient role. Managing is deliberately manager-level — the
-- whole point of a managed profile is that somebody operates it fully.
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
    select 1 from public.profiles p
    where p.id = p_owner and p.managed_by = (select auth.uid())
  )
  or exists (
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

-- ---------------------------------------------------------------------------
-- profiles RLS
--
-- I can see a profile if it is mine, if I manage it, or if it has been shared
-- with me. Creating profiles is how a managed profile comes into being, so the
-- insert policy allows it only with myself as the manager; the signup trigger
-- creates self-managed rows as the definer and is unaffected.
-- ---------------------------------------------------------------------------


create policy "Owner or circle can view profile" on public.profiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or managed_by = (select auth.uid())
    or public.has_circle_access(id, 'viewer', 'profiles')
  );

create policy "Owner or manager can insert profile" on public.profiles
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    or (managed_by = (select auth.uid()) and user_id is null)
  );

create policy "Owner or circle can update profile" on public.profiles
  for update to authenticated
  using (
    user_id = (select auth.uid())
    or managed_by = (select auth.uid())
    or public.has_circle_access(id, 'caregiver', 'profiles')
  )
  with check (
    user_id = (select auth.uid())
    or managed_by = (select auth.uid())
    or public.has_circle_access(id, 'caregiver', 'profiles')
  );

create policy "Owner or manager can delete profile" on public.profiles
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or managed_by = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Health-table RLS, now keyed on the profile.
--
-- Same ladder as before — select needs viewer, insert/update caregiver, delete
-- manager — and generated in a loop because the six tables differ only by name.
-- The table name doubles as the share category, as it always has.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['documents', 'medicines', 'vitals', 'allergies', 'conditions', 'doctors']
  loop
    execute format($p$
      create policy %I on public.%I
        for select to authenticated
        using (profile_id = public.current_profile_id()
               or public.has_circle_access(profile_id, 'viewer', %L))
    $p$, format('Owner or circle can view %s', t), t, t);

    execute format($p$
      create policy %I on public.%I
        for insert to authenticated
        with check (profile_id = public.current_profile_id()
                    or public.has_circle_access(profile_id, 'caregiver', %L))
    $p$, format('Owner or circle can insert %s', t), t, t);

    execute format($p$
      create policy %I on public.%I
        for update to authenticated
        using (profile_id = public.current_profile_id()
               or public.has_circle_access(profile_id, 'caregiver', %L))
        with check (profile_id = public.current_profile_id()
                    or public.has_circle_access(profile_id, 'caregiver', %L))
    $p$, format('Owner or circle can update %s', t), t, t, t);

    execute format($p$
      create policy %I on public.%I
        for delete to authenticated
        using (profile_id = public.current_profile_id()
               or public.has_circle_access(profile_id, 'manager', %L))
    $p$, format('Owner or circle can delete %s', t), t, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- circle_memberships and circle_invites RLS: "the owner" is now whoever holds
-- the profile, which includes its manager.
-- ---------------------------------------------------------------------------


create policy "Owner and member can view memberships" on public.circle_memberships
  for select to authenticated
  using (member_id = (select auth.uid()) or public.owns_profile(owner_id, (select auth.uid())));

create policy "Owner can invite members" on public.circle_memberships
  for insert to authenticated
  with check (
    public.owns_profile(owner_id, (select auth.uid()))
    and status = 'pending' and accepted_at is null and revoked_at is null
  );

create policy "Owner can update own memberships" on public.circle_memberships
  for update to authenticated
  using (public.owns_profile(owner_id, (select auth.uid())))
  with check (public.owns_profile(owner_id, (select auth.uid())));

create policy "Member can respond to invites" on public.circle_memberships
  for update to authenticated
  using (member_id = (select auth.uid()))
  with check (member_id = (select auth.uid()));


create policy "Owner can view own invites" on public.circle_invites
  for select to authenticated
  using (public.owns_profile(owner_id, (select auth.uid())));

create policy "Owner can create invites" on public.circle_invites
  for insert to authenticated
  with check (public.owns_profile(owner_id, (select auth.uid())) and status = 'pending');

create policy "Owner can update own invites" on public.circle_invites
  for update to authenticated
  using (public.owns_profile(owner_id, (select auth.uid())))
  with check (public.owns_profile(owner_id, (select auth.uid())));

create policy "Owner can delete own invites" on public.circle_invites
  for delete to authenticated
  using (public.owns_profile(owner_id, (select auth.uid())));

-- ---------------------------------------------------------------------------
-- audit_log RLS: read your own trail (and the trails of profiles you manage).
-- ---------------------------------------------------------------------------


create policy "Owner can view own audit log" on public.audit_log
  for select to authenticated
  using (public.owns_profile(owner_id, (select auth.uid())));

create policy "Actors can append audit entries" on public.audit_log
  for insert to authenticated
  with check (
    actor_id = (select auth.uid())
    and (
      public.owns_profile(owner_id, (select auth.uid()))
      or public.has_circle_access(owner_id, 'viewer', resource_type)
    )
  );

-- ---------------------------------------------------------------------------
-- Circle functions, re-pointed at profiles.
--
-- `counterpart_id` is now a profile id in both directions, which is what the
-- app scopes its queries by: for a circle I am in, it is the profile I can
-- read; for my own circle, it is the member's own profile.
-- ---------------------------------------------------------------------------

create or replace function public.list_circle_people()
returns table (
  membership_id uuid,
  direction text,
  counterpart_id uuid,
  counterpart_name text,
  role public.circle_role,
  shared_categories text[],
  status public.membership_status,
  accepted_at timestamptz,
  revoked_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    m.id,
    'owner',
    (select p.id from public.profiles p where p.user_id = m.member_id),
    (select p.full_name from public.profiles p where p.user_id = m.member_id),
    m.role, m.shared_categories, m.status, m.accepted_at, m.revoked_at
  from public.circle_memberships m
  where public.owns_profile(m.owner_id, (select auth.uid()))
  union all
  select
    m.id,
    'member',
    m.owner_id,
    (select p.full_name from public.profiles p where p.id = m.owner_id),
    m.role, m.shared_categories, m.status, m.accepted_at, m.revoked_at
  from public.circle_memberships m
  where m.member_id = (select auth.uid());
$$;

revoke execute on function public.list_circle_people() from public, anon;
grant execute on function public.list_circle_people() to authenticated;

create or replace function public.preview_circle_invite(p_secret text)
returns table (
  owner_id uuid,
  owner_name text,
  requested_role public.circle_role,
  requested_categories text[],
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.circle_invites := public.resolve_circle_invite(p_secret);
begin
  return query
  select
    invite.owner_id,
    (select p.full_name from public.profiles p where p.id = invite.owner_id),
    invite.requested_role,
    invite.requested_categories,
    invite.expires_at;
end;
$$;

revoke execute on function public.preview_circle_invite(text) from public, anon;
grant execute on function public.preview_circle_invite(text) to authenticated;

create or replace function public.accept_circle_invite(p_secret text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.circle_invites := public.resolve_circle_invite(p_secret);
  me uuid := (select auth.uid());
begin
  if public.owns_profile(invite.owner_id, me) then
    raise exception 'You cannot accept your own invite.'
      using errcode = 'check_violation';
  end if;

  perform set_config('app.circle_invite_ctx', 'on', true);

  insert into public.circle_memberships
    (owner_id, member_id, role, shared_categories, status, accepted_at)
  values
    (invite.owner_id, me, invite.requested_role, invite.requested_categories,
     'active', now())
  on conflict (owner_id, member_id) do update
    set role = excluded.role,
        shared_categories = excluded.shared_categories,
        status = 'active',
        accepted_at = now(),
        revoked_at = null;

  update public.circle_invites
    set status = 'accepted', responded_at = now()
    where id = invite.id;

  insert into public.audit_log (actor_id, owner_id, action, resource_type)
  values (me, invite.owner_id, 'joined_circle', 'circle');

  return invite.owner_id;
end;
$$;

revoke execute on function public.accept_circle_invite(text) from public, anon;
grant execute on function public.accept_circle_invite(text) to authenticated;

create or replace function public.decline_circle_invite(p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.circle_invites := public.resolve_circle_invite(p_secret);
begin
  if public.owns_profile(invite.owner_id, (select auth.uid())) then
    raise exception 'You cannot decline your own invite.'
      using errcode = 'check_violation';
  end if;

  update public.circle_invites
    set status = 'declined', responded_at = now()
    where id = invite.id;
end;
$$;

revoke execute on function public.decline_circle_invite(text) from public, anon;
grant execute on function public.decline_circle_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Audit functions: the owner is a profile, the actor is still an account.
-- ---------------------------------------------------------------------------

create or replace function public.log_audit_event(
  p_owner uuid,
  p_action text,
  p_resource_type text,
  p_resource_id uuid default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;

  -- A profile you hold yourself is not feed material.
  if public.owns_profile(p_owner, actor) then
    return;
  end if;

  if p_action not in ('viewed', 'added', 'updated', 'deleted', 'sent_reminder') then
    raise exception 'Unknown audit action.' using errcode = 'check_violation';
  end if;

  if p_resource_type not in (
    'profiles', 'documents', 'medicines', 'vitals', 'allergies', 'conditions', 'doctors'
  ) then
    raise exception 'Unknown resource type.' using errcode = 'check_violation';
  end if;

  if not public.has_circle_access(p_owner, 'viewer', p_resource_type) then
    raise exception 'You do not have access to this account.'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.audit_log (actor_id, owner_id, action, resource_type, resource_id)
  values (actor, p_owner, p_action, p_resource_type, p_resource_id);
end;
$$;

revoke execute on function public.log_audit_event(uuid, text, text, uuid) from public, anon;
grant execute on function public.log_audit_event(uuid, text, text, uuid) to authenticated;

create or replace function public.list_audit_feed(
  p_limit int default 30,
  p_before_at timestamptz default null,
  p_before_id bigint default null
) returns table (
  id bigint,
  actor_id uuid,
  actor_name text,
  action text,
  resource_type text,
  resource_id uuid,
  resource_label text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    a.actor_id,
    (select p.full_name from public.profiles p where p.user_id = a.actor_id),
    a.action,
    a.resource_type,
    a.resource_id,
    case a.resource_type
      when 'documents' then (select d.title from public.documents d where d.id = a.resource_id)
      when 'medicines' then (select m.name from public.medicines m where m.id = a.resource_id)
      when 'conditions' then (select c.name from public.conditions c where c.id = a.resource_id)
      when 'allergies' then (select al.allergen from public.allergies al where al.id = a.resource_id)
      when 'doctors' then (select dr.name from public.doctors dr where dr.id = a.resource_id)
      when 'vitals' then (select v.type::text from public.vitals v where v.id = a.resource_id)
    end,
    a.created_at
  from public.audit_log a
  where public.owns_profile(a.owner_id, (select auth.uid()))
    and a.actor_id <> (select auth.uid())
    and (
      p_before_at is null
      or (a.created_at, a.id) < (p_before_at, coalesce(p_before_id, 9223372036854775807))
    )
  order by a.created_at desc, a.id desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

revoke execute on function public.list_audit_feed(int, timestamptz, bigint) from public, anon;
grant execute on function public.list_audit_feed(int, timestamptz, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: files now live under the profile's id.
--
-- document_path_owner resolves either prefix, so anything uploaded before this
-- migration — under the uploader's auth id — keeps working for its owner and
-- for their circle, without moving a single object.
-- ---------------------------------------------------------------------------

create or replace function public.document_path_owner(p_name text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  with prefix as (
    select case
      when (storage.foldername(p_name))[1] ~*
           '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then ((storage.foldername(p_name))[1])::uuid
    end as id
  )
  select coalesce(
    (select p.id from public.profiles p, prefix where p.id = prefix.id),
    (select p.id from public.profiles p, prefix where p.user_id = prefix.id)
  );
$$;

revoke execute on function public.document_path_owner(text) from public, anon;
grant execute on function public.document_path_owner(text) to authenticated;


create policy "Owner or circle can view health documents" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'health-documents'
    and (
      public.owns_profile(public.document_path_owner(name), (select auth.uid()))
      or public.has_circle_access(public.document_path_owner(name), 'viewer', 'documents')
    )
  );

create policy "Owner or circle can upload health documents" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'health-documents'
    and (
      public.owns_profile(public.document_path_owner(name), (select auth.uid()))
      or public.has_circle_access(public.document_path_owner(name), 'caregiver', 'documents')
    )
  );

create policy "Owner or circle can update health documents" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'health-documents'
    and (
      public.owns_profile(public.document_path_owner(name), (select auth.uid()))
      or public.has_circle_access(public.document_path_owner(name), 'caregiver', 'documents')
    )
  );

create policy "Owner or circle can delete health documents" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'health-documents'
    and (
      public.owns_profile(public.document_path_owner(name), (select auth.uid()))
      or public.has_circle_access(public.document_path_owner(name), 'manager', 'documents')
    )
  );

-- ---------------------------------------------------------------------------
-- The membership transition rules, re-stated for profile owners.
--
-- KAR-33 decided who was acting by comparing auth.uid() to owner_id. Now that
-- owner_id names a profile rather than an account, that comparison can never be
-- true — which would quietly let an owner move a membership anywhere. Ownership
-- is asked of the profile instead.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_membership_transition()
returns trigger
language plpgsql
as $$
declare
  actor uuid := (select auth.uid());
begin
  -- Trusted invite-acceptance path: skip the owner/member transition rules.
  if current_setting('app.circle_invite_ctx', true) = 'on' then
    return new;
  end if;

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
  elsif public.owns_profile(old.owner_id, actor) then
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
