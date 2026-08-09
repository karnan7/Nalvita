-- Managed profiles (KAR-53, part 2 of 2 for KAR-48).
--
-- 20260805100000 separated a person from an account: a profile can carry a
-- null user_id and be operated by whoever is named in managed_by. Nothing has
-- created such a row yet. This migration makes managed profiles usable:
--
--   profiles.is_minor       a managed profile can be a child, and is labelled so
--   the cap                 at most six managed profiles per account
--   profile_claims          the handover: a managed profile becomes their own
--
-- Handover is deliberately two-sided and ends with the manager, not the
-- claimant. The person claiming consents first (they see exactly what they are
-- taking on); the manager then confirms against a named account. A link that
-- leaks therefore cannot quietly move a parent's records to a stranger — the
-- manager sees who is asking before anything moves.

-- ---------------------------------------------------------------------------
-- A managed profile may be a child.
--
-- Stored rather than derived from date_of_birth: the date is often unknown for
-- an elderly parent and approximate for a child, and "is this a minor" changes
-- how the app talks about them, which is not something to guess at.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column is_minor boolean not null default false;

-- ---------------------------------------------------------------------------
-- The cap.
--
-- Six is enough for a family and small enough that bulk profile creation is not
-- a way to mint free storage. Enforced in the database because the RLS insert
-- policy is otherwise happy to accept any number of them.
--
-- DEFINER so the count is of every profile the account manages, not only the
-- ones the caller's own policies would return.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_managed_profile_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  held int;
begin
  if new.managed_by is null or new.user_id is not null then
    return new;
  end if;

  select count(*) into held
  from public.profiles p
  where p.managed_by = new.managed_by
    and p.user_id is null;

  if held >= 6 then
    raise exception 'You can look after up to 6 profiles.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger profiles_managed_cap
  before insert on public.profiles
  for each row execute function public.enforce_managed_profile_cap();

-- ---------------------------------------------------------------------------
-- Claim status.
--
-- Distinct from invite_status because the shapes genuinely differ: a circle
-- invite is answered once, a claim is answered twice. 'awaiting_manager' is the
-- gap between the two answers.
-- ---------------------------------------------------------------------------

create type public.claim_status as enum (
  'pending',            -- sent; nobody has claimed it yet
  'awaiting_manager',   -- claimed and consented to; the manager must confirm
  'completed',          -- the profile is theirs
  'declined',           -- refused, by either side
  'expired'
);

-- ---------------------------------------------------------------------------
-- profile_claims
--
-- Same secret handling as circle_invites (KAR-44): a high-entropy link token
-- and a short typed code, both stored only as SHA-256 hashes, so the table is
-- worthless to anyone who reads it.
-- ---------------------------------------------------------------------------

create table public.profile_claims (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  manager_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null,
  code_hash text not null,
  invitee_email text,                  -- display and dedup only
  status public.claim_status not null default 'pending',
  claimed_by uuid references auth.users (id) on delete cascade,
  claimed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '72 hours'),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index profile_claims_token_hash_idx on public.profile_claims (token_hash);
create index profile_claims_code_hash_idx on public.profile_claims (code_hash);
create index profile_claims_profile_idx on public.profile_claims (profile_id);

-- One live claim per profile: two people holding valid links for the same
-- parent is a race nobody wants to reason about.
create unique index profile_claims_one_live_per_profile
  on public.profile_claims (profile_id)
  where status in ('pending', 'awaiting_manager');

alter table public.profile_claims enable row level security;

-- Only the manager touches this table directly. The claimant holds a secret and
-- goes through the DEFINER functions, exactly as an invitee does.
create policy "Manager can view claims for profiles they manage" on public.profile_claims
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.managed_by = (select auth.uid())
    )
  );

create policy "Manager can create claims for profiles they manage" on public.profile_claims
  for insert to authenticated
  with check (
    manager_id = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.managed_by = (select auth.uid()) and p.user_id is null
    )
  );

-- Cancelling an unused claim is a delete, matching how circle invites are
-- cancelled. Refusing one that has already been claimed is a status change, and
-- goes through reject_profile_claim() so the reason is recorded.
create policy "Manager can cancel claims for profiles they manage" on public.profile_claims
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.managed_by = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Claim lifecycle (SECURITY DEFINER).
-- ---------------------------------------------------------------------------

-- Resolve a live claim by its secret, or raise. Mirrors resolve_circle_invite,
-- including its throttle: the 6-digit code is low entropy, so failures cost.
create or replace function public.resolve_profile_claim(p_secret text)
returns public.profile_claims
language plpgsql
security definer
set search_path = ''
as $$
declare
  hashed text := encode(extensions.digest(p_secret, 'sha256'), 'hex');
  claim public.profile_claims;
begin
  select * into claim
  from public.profile_claims
  where status in ('pending', 'awaiting_manager')
    and (token_hash = hashed or code_hash = hashed)
  limit 1;

  if not found then
    perform public.record_invite_failure();
    raise exception 'This claim code is not valid.'
      using errcode = 'no_data_found';
  end if;

  if claim.expires_at <= now() then
    update public.profile_claims set status = 'expired' where id = claim.id;
    raise exception 'This claim link has expired.'
      using errcode = 'no_data_found';
  end if;

  return claim;
end;
$$;

revoke execute on function public.resolve_profile_claim(text) from public, anon, authenticated;

-- How much is stored under a profile, across every health table. Used for the
-- claim preview and for deciding whether an account's own profile is still
-- empty enough to be replaced by the one it is claiming.
create or replace function public.count_profile_records(p_profile uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.documents where profile_id = p_profile)
  + (select count(*) from public.medicines where profile_id = p_profile)
  + (select count(*) from public.vitals where profile_id = p_profile)
  + (select count(*) from public.allergies where profile_id = p_profile)
  + (select count(*) from public.conditions where profile_id = p_profile)
  + (select count(*) from public.doctors where profile_id = p_profile);
$$;

revoke execute on function public.count_profile_records(uuid) from public, anon, authenticated;

-- What the claimant is being offered, before they agree to anything: whose
-- records these are, who has been keeping them, and how much is there. Counts
-- rather than contents — enough to recognise the profile as theirs without
-- disclosing health data to whoever happens to hold the link.
create or replace function public.preview_profile_claim(p_secret text)
returns table (
  profile_id uuid,
  profile_name text,
  date_of_birth date,
  manager_name text,
  record_count bigint,
  expires_at timestamptz,
  already_claimed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim public.profile_claims := public.resolve_profile_claim(p_secret);
begin
  return query
  select
    claim.profile_id,
    (select p.full_name from public.profiles p where p.id = claim.profile_id),
    (select p.date_of_birth from public.profiles p where p.id = claim.profile_id),
    (select p.full_name from public.profiles p where p.user_id = claim.manager_id),
    public.count_profile_records(claim.profile_id),
    claim.expires_at,
    claim.status = 'awaiting_manager';
end;
$$;

revoke execute on function public.preview_profile_claim(text) from public, anon;
grant execute on function public.preview_profile_claim(text) to authenticated;

-- The claimant's half of the handshake: "yes, this is me, and I want it".
-- Nothing moves yet — the manager still has to confirm against this account.
create or replace function public.accept_profile_claim(p_secret text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim public.profile_claims := public.resolve_profile_claim(p_secret);
  me uuid := (select auth.uid());
  mine uuid;
begin
  if me = claim.manager_id then
    raise exception 'You already look after this profile.'
      using errcode = 'check_violation';
  end if;

  if claim.status = 'awaiting_manager' and claim.claimed_by <> me then
    raise exception 'Someone else has already claimed this profile.'
      using errcode = 'check_violation';
  end if;

  -- Claiming replaces the account's own profile, so that profile has to be one
  -- nothing has been written to. Refusing here rather than at the transfer
  -- means the person finds out before the manager is asked to confirm.
  select p.id into mine from public.profiles p where p.user_id = me;
  if mine is not null and public.count_profile_records(mine) > 0 then
    raise exception 'This account already has its own health records. Claim from a new account instead.'
      using errcode = 'check_violation';
  end if;

  update public.profile_claims
    set status = 'awaiting_manager', claimed_by = me, claimed_at = now()
    where id = claim.id;

  return claim.profile_id;
end;
$$;

revoke execute on function public.accept_profile_claim(text) from public, anon;
grant execute on function public.accept_profile_claim(text) to authenticated;

-- The claimant says no. The profile stays exactly as it was.
create or replace function public.decline_profile_claim(p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim public.profile_claims := public.resolve_profile_claim(p_secret);
  me uuid := (select auth.uid());
begin
  if me = claim.manager_id then
    raise exception 'You cannot decline a claim you sent.'
      using errcode = 'check_violation';
  end if;

  -- Once someone has claimed it, only they can withdraw. Otherwise anyone who
  -- came across the link could cancel a handover already under way.
  if claim.status = 'awaiting_manager' and claim.claimed_by <> me then
    raise exception 'Someone else has already claimed this profile.'
      using errcode = 'check_violation';
  end if;

  update public.profile_claims
    set status = 'declined', responded_at = now()
    where id = claim.id;
end;
$$;

revoke execute on function public.decline_profile_claim(text) from public, anon;
grant execute on function public.decline_profile_claim(text) to authenticated;

-- What the manager sees: their outstanding claims, and who has asked for one.
-- The claimant's name comes from their own profile, which ordinary RLS does not
-- let the manager read — but they are being asked to hand records to this
-- person, so they need to know who it is.
create or replace function public.list_profile_claims()
returns table (
  id uuid,
  profile_id uuid,
  profile_name text,
  status public.claim_status,
  invitee_email text,
  claimant_name text,
  claimed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.profile_id,
    (select p.full_name from public.profiles p where p.id = c.profile_id),
    c.status,
    c.invitee_email,
    (select p.full_name from public.profiles p where p.user_id = c.claimed_by),
    c.claimed_at,
    c.expires_at,
    c.created_at
  from public.profile_claims c
  where c.status in ('pending', 'awaiting_manager')
    and exists (
      select 1 from public.profiles p
      where p.id = c.profile_id and p.managed_by = (select auth.uid())
    )
  order by c.created_at desc;
$$;

revoke execute on function public.list_profile_claims() from public, anon;
grant execute on function public.list_profile_claims() to authenticated;

-- ---------------------------------------------------------------------------
-- The handover.
--
-- One function, one transaction. Either the profile becomes theirs and the
-- former manager keeps caregiver access, or nothing at all happened — there is
-- no state in which a profile is half-claimed or reachable by nobody.
-- ---------------------------------------------------------------------------

create or replace function public.complete_profile_claim(p_claim uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim public.profile_claims;
  me uuid := (select auth.uid());
  claimant_profile uuid;
begin
  -- Locked for the rest of the transaction: two confirmations racing must not
  -- both get past the status check.
  select * into claim
  from public.profile_claims
  where id = p_claim
  for update;

  if not found then
    raise exception 'This handover no longer exists.' using errcode = 'no_data_found';
  end if;

  if claim.manager_id <> me
     or not exists (
       select 1 from public.profiles p
       where p.id = claim.profile_id and p.managed_by = me
     ) then
    raise exception 'Only the person looking after this profile can hand it over.'
      using errcode = 'insufficient_privilege';
  end if;

  if claim.status <> 'awaiting_manager' then
    raise exception 'Nobody has claimed this profile yet.' using errcode = 'check_violation';
  end if;

  if claim.expires_at <= now() then
    update public.profile_claims set status = 'expired' where id = claim.id;
    raise exception 'This claim link has expired.' using errcode = 'no_data_found';
  end if;

  -- Re-checked at the moment of transfer, not just at accept time: the claimant
  -- has had an account in the meantime and may have started using it.
  select p.id into claimant_profile from public.profiles p where p.user_id = claim.claimed_by;
  if claimant_profile is not null and public.count_profile_records(claimant_profile) > 0 then
    raise exception 'That account now has its own health records, so it cannot take this profile over.'
      using errcode = 'check_violation';
  end if;

  -- profiles.user_id is unique, so their empty signup profile has to go before
  -- the claimed one can carry the account.
  if claimant_profile is not null then
    delete from public.profiles where id = claimant_profile;
  end if;

  update public.profiles
    set user_id = claim.claimed_by,
        managed_by = null,
        is_minor = false
    where id = claim.profile_id;

  -- The manager stays involved, one rung down. Written in the trusted invite
  -- context because the KAR-33 transition trigger reasonably refuses membership
  -- rows created on someone else's behalf.
  perform set_config('app.circle_invite_ctx', 'on', true);

  insert into public.circle_memberships
    (owner_id, member_id, role, shared_categories, status, accepted_at)
  values
    (claim.profile_id, me, 'caregiver', array['all'], 'active', now())
  on conflict (owner_id, member_id) do update
    set role = 'caregiver',
        shared_categories = array['all'],
        status = 'active',
        accepted_at = now(),
        revoked_at = null;

  update public.profile_claims
    set status = 'completed', responded_at = now()
    where id = claim.id;

  -- The seam in their history: everything before this entry was done for them
  -- by someone else. The actor is the manager, because handing over is their
  -- act — which is also what puts it in the new owner's feed, since the feed
  -- shows what other people did.
  insert into public.audit_log (actor_id, owner_id, action, resource_type)
  values (me, claim.profile_id, 'handed_over_profile', 'profiles');

  return claim.profile_id;
end;
$$;

revoke execute on function public.complete_profile_claim(uuid) from public, anon;
grant execute on function public.complete_profile_claim(uuid) to authenticated;

-- The manager's other answer: this is not the person I meant.
create or replace function public.reject_profile_claim(p_claim uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profile_claims c
    set status = 'declined', responded_at = now()
    where c.id = p_claim
      and c.manager_id = (select auth.uid())
      and c.status = 'awaiting_manager';

  if not found then
    raise exception 'This handover no longer exists.' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke execute on function public.reject_profile_claim(uuid) from public, anon;
grant execute on function public.reject_profile_claim(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Audit: a manager's work on a managed profile is feed material after all.
--
-- log_audit_event() has skipped anything done by someone who "owns" the
-- profile, and managing counts as owning. That was right while every profile
-- was an account, but it means a claimed profile arrives with an empty history
-- — the new owner cannot see a single thing that was done for them before the
-- handover, which is exactly the transparency the feed exists to provide.
--
-- Only actions on your own account are skipped now. Nothing else changes: the
-- category and role checks below are unchanged, and for a self-managed profile
-- the behaviour is identical to before.
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

  -- Your own records are not news to you.
  if exists (
    select 1 from public.profiles p where p.id = p_owner and p.user_id = actor
  ) then
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

-- ---------------------------------------------------------------------------
-- Table privileges (KAR-42 pattern: new tables bring their own grants).
-- No UPDATE for authenticated — every status change runs through a function
-- that checks which half of the handshake the caller is.
-- ---------------------------------------------------------------------------

grant select, insert, delete on public.profile_claims to authenticated;
grant select, insert, update, delete on public.profile_claims to service_role;
