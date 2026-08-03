-- Health Circle invites (KAR-44).
--
-- KAR-33 built the destination — circle_memberships + has_circle_access() — but
-- its insert model needs the owner to already know the member's user id. Real
-- invites don't: the owner generates a code/link and sends it to someone whose
-- account they may not know yet, and that person accepts. This migration adds
-- the invite mechanism on top of the existing model without touching its RLS.
--
-- Secrets: each invite carries a high-entropy link token (the real secret, put
-- in the shareable deep link) and a short 6-digit code (a convenience for
-- manual entry). Only their SHA-256 hashes are stored, so a leak of the table
-- never yields a usable credential. The invitee cannot read invite rows (RLS is
-- owner-only); they interact through the SECURITY DEFINER functions below,
-- which hash the presented secret and look it up. Because a 6-digit code is
-- low entropy, every failed lookup is throttled per acting user.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------

create type public.invite_status as enum ('pending', 'accepted', 'declined', 'expired');

-- ---------------------------------------------------------------------------
-- circle_invites
-- ---------------------------------------------------------------------------

create table public.circle_invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null,               -- sha256 of the link token (primary secret)
  code_hash text not null,                -- sha256 of the 6-digit code (manual entry)
  invitee_email text,                     -- optional, for dedup + display only
  requested_role public.circle_role not null default 'viewer',
  requested_categories text[] not null default '{all}',
  status public.invite_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

-- Accept/preview look invites up by hash across all owners (via SECURITY DEFINER).
create index circle_invites_token_hash_idx on public.circle_invites (token_hash);
create index circle_invites_code_hash_idx on public.circle_invites (code_hash);

-- At most one live invite per (owner, invited email), so re-inviting the same
-- person updates rather than stacks. Only enforced when an email is provided.
create unique index circle_invites_one_pending_per_email
  on public.circle_invites (owner_id, lower(invitee_email))
  where status = 'pending' and invitee_email is not null;

-- ---------------------------------------------------------------------------
-- circle_invites RLS — owner-only. Invitees never touch this table directly;
-- they go through the SECURITY DEFINER functions.
-- ---------------------------------------------------------------------------

alter table public.circle_invites enable row level security;

create policy "Owner can view own invites" on public.circle_invites
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owner can create invites" on public.circle_invites
  for insert to authenticated
  with check ((select auth.uid()) = owner_id and status = 'pending');

create policy "Owner can update own invites" on public.circle_invites
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Owner can delete own invites" on public.circle_invites
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- ---------------------------------------------------------------------------
-- Rate limiting for secret lookups. No policies + no grants: only the DEFINER
-- functions below (running as the table owner) ever read or write this.
-- ---------------------------------------------------------------------------

create table public.circle_invite_attempts (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  attempted_at timestamptz not null default now()
);

create index circle_invite_attempts_actor_idx
  on public.circle_invite_attempts (actor_id, attempted_at desc);

alter table public.circle_invite_attempts enable row level security;

-- Records a failed secret lookup and raises once the caller has failed too many
-- times in the last hour. Valid tokens never reach here, so honest invitees who
-- preview then accept are never throttled; only guessers accumulate failures.
create or replace function public.record_invite_failure()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent int;
begin
  insert into public.circle_invite_attempts (actor_id)
  values ((select auth.uid()));

  select count(*) into recent
  from public.circle_invite_attempts
  where actor_id = (select auth.uid())
    and attempted_at > now() - interval '1 hour';

  if recent > 10 then
    raise exception 'Too many attempts. Please wait a while and try again.'
      using errcode = 'check_violation';
  end if;
end;
$$;

revoke execute on function public.record_invite_failure() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Trigger bypass for membership writes.
--
-- Accepting an invite must be able to (re)create a circle_membership on behalf
-- of the invitee — including reactivating a previously revoked one. The
-- KAR-33 transition trigger deliberately forbids that for ordinary callers, so
-- the accept function opens a narrow, transaction-local bypass that only these
-- trusted DEFINER functions can set. Re-created (not edited) here additively.
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

-- ---------------------------------------------------------------------------
-- Invite lifecycle functions (SECURITY DEFINER).
-- Each takes the plaintext secret (link token or 6-digit code), hashes it, and
-- resolves the matching live invite. Invitees hold the secret; they never need
-- read access to the table.
-- ---------------------------------------------------------------------------

-- Resolve a live (pending, unexpired) invite by its secret, or raise. Lazily
-- marks a matched-but-expired invite as expired. Throttles on failure.
create or replace function public.resolve_circle_invite(p_secret text)
returns public.circle_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  hashed text := encode(extensions.digest(p_secret, 'sha256'), 'hex');
  invite public.circle_invites;
begin
  select * into invite
  from public.circle_invites
  where status = 'pending'
    and (token_hash = hashed or code_hash = hashed)
  limit 1;

  if not found then
    perform public.record_invite_failure();
    raise exception 'This invite code is not valid.'
      using errcode = 'no_data_found';
  end if;

  if invite.expires_at <= now() then
    update public.circle_invites set status = 'expired' where id = invite.id;
    raise exception 'This invite has expired.'
      using errcode = 'no_data_found';
  end if;

  return invite;
end;
$$;

revoke execute on function public.resolve_circle_invite(text) from public, anon, authenticated;

-- Read-only consent preview: who is inviting, and exactly what they're asking
-- for. Safe to disclose to whoever holds the secret — they were sent it.
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
    (select p.full_name from public.profiles p where p.user_id = invite.owner_id),
    invite.requested_role,
    invite.requested_categories,
    invite.expires_at;
end;
$$;

revoke execute on function public.preview_circle_invite(text) from public, anon;
grant execute on function public.preview_circle_invite(text) to authenticated;

-- Accept an invite: create (or reactivate) an active membership for the caller.
-- The caller cannot be the owner. Idempotent if already an active member.
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
  if me = invite.owner_id then
    raise exception 'You cannot accept your own invite.'
      using errcode = 'check_violation';
  end if;

  -- Trusted context: allow the reactivation update the KAR-33 trigger blocks.
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

  return invite.owner_id;
end;
$$;

revoke execute on function public.accept_circle_invite(text) from public, anon;
grant execute on function public.accept_circle_invite(text) to authenticated;

-- Decline an invite: leaves no membership behind, just marks the invite.
create or replace function public.decline_circle_invite(p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.circle_invites := public.resolve_circle_invite(p_secret);
begin
  if (select auth.uid()) = invite.owner_id then
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

-- List everyone connected to the caller, in both directions, with the
-- counterpart's display name. A DEFINER function is needed because ordinary
-- profile RLS does not let an owner read a member's name (the owner isn't a
-- member of the member's circle). Only rows involving the caller are returned,
-- so this discloses nothing the caller isn't already party to.
create or replace function public.list_circle_people()
returns table (
  membership_id uuid,
  direction text,               -- 'owner' = they're in my circle; 'member' = I'm in theirs
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
    m.member_id,
    (select p.full_name from public.profiles p where p.user_id = m.member_id),
    m.role, m.shared_categories, m.status, m.accepted_at, m.revoked_at
  from public.circle_memberships m
  where m.owner_id = (select auth.uid())
  union all
  select
    m.id,
    'member',
    m.owner_id,
    (select p.full_name from public.profiles p where p.user_id = m.owner_id),
    m.role, m.shared_categories, m.status, m.accepted_at, m.revoked_at
  from public.circle_memberships m
  where m.member_id = (select auth.uid());
$$;

revoke execute on function public.list_circle_people() from public, anon;
grant execute on function public.list_circle_people() to authenticated;

-- ---------------------------------------------------------------------------
-- Table privileges (KAR-42 pattern: new tables must add their own grants).
-- Owner manages their own invite rows directly; RLS scopes every row. The
-- attempts table gets no grants — only the DEFINER functions touch it.
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.circle_invites to authenticated;
