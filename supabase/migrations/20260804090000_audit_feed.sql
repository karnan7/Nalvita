-- Activity feed + trustworthy audit writes (KAR-45).
--
-- KAR-33 created audit_log with an owner-only read policy and an insert policy
-- that pins actor_id to auth.uid(). That is enough to stop impersonation, but a
-- circle member could still write arbitrary `action` strings into someone
-- else's feed ("deleted all your records"), and the owner cannot read the
-- actor's name (they aren't a member of the actor's circle), so the feed had no
-- way to say "Arjun viewed your Chest X-ray".
--
-- This migration adds the two SECURITY DEFINER entry points the feature needs:
--   * log_audit_event()  — the only sanctioned way for the app to append. The
--     actor is derived from auth.uid(), the action comes from a fixed
--     vocabulary, and the caller must actually have circle access to the
--     account they are writing about.
--   * list_audit_feed()  — the owner's feed, newest first, keyset-paginated,
--     resolving the actor's display name and the record's label at read time
--     (so titles are never duplicated into the log).
--
-- Nothing about the existing policies changes: audit_log stays append-only and
-- owner-read-only, and with zero circle_memberships rows both functions are
-- inert (log_audit_event ignores actions on your own account, and the feed is
-- empty because it only ever shows what other people did).

-- ---------------------------------------------------------------------------
-- log_audit_event
--
-- Deliberately silent for self-actions: the app can call it after every write
-- without knowing whether it is operating on its own account or someone
-- else's, and the database decides whether it is feed material. Your own
-- actions in your own account are already visible to you everywhere else.
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
    raise exception 'Not signed in.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Own account: nothing to record for the feed.
  if actor = p_owner then
    return;
  end if;

  -- Fixed vocabulary, mirrored by AUDIT_ACTIONS in @nalvita/core. Keeping the
  -- verbs server-side means a member cannot invent an alarming entry.
  if p_action not in ('viewed', 'added', 'updated', 'deleted', 'sent_reminder') then
    raise exception 'Unknown audit action.'
      using errcode = 'check_violation';
  end if;

  -- resource_type doubles as the share category, so it must be a real one.
  if p_resource_type not in (
    'profiles', 'documents', 'medicines', 'vitals', 'allergies', 'conditions', 'doctors'
  ) then
    raise exception 'Unknown resource type.'
      using errcode = 'check_violation';
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
-- list_audit_feed
--
-- The caller only ever sees their own account's trail, and only entries other
-- people created. A DEFINER function is needed twice over: to read the actor's
-- display name (ordinary profile RLS does not let an owner read a member's
-- profile) and to resolve record labels the owner may since have deleted.
--
-- Pagination is keyset on (created_at, id) rather than OFFSET, so a busy feed
-- never skips or repeats an entry between pages.
-- ---------------------------------------------------------------------------

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
  where a.owner_id = (select auth.uid())
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
-- Joining a circle is itself feed-worthy: the owner should see "Appa joined
-- your circle" without having to compare membership lists. Re-created (not
-- edited) additively on top of the KAR-44 definition; the only change is the
-- audit insert, which runs as the definer so it bypasses the append policy's
-- category check ('circle' is not a shareable category).
-- ---------------------------------------------------------------------------

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

  insert into public.audit_log (actor_id, owner_id, action, resource_type)
  values (me, invite.owner_id, 'joined_circle', 'circle');

  return invite.owner_id;
end;
$$;

revoke execute on function public.accept_circle_invite(text) from public, anon;
grant execute on function public.accept_circle_invite(text) to authenticated;
