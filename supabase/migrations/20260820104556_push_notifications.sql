-- Push notification foundation (KAR-52).
--
-- The plumbing that reminders (KAR-47) and circle notifications (KAR-44) stand
-- on: devices register themselves, one send path fans out to them, and dead
-- tokens are pruned. Three tables and one enum, no feature logic — a feature
-- decides *what* to say, never *how* to deliver it.
--
-- Two things here are privacy decisions rather than plumbing:
--
--   * notification_detail defaults to 'generic'. A push notification renders on
--     a locked screen, in front of whoever is holding the phone. "Time for your
--     2pm medicine" is safe there; "Time for your Metformin" tells a stranger
--     on a train that this person is diabetic. Detail is opt-in, so the safe
--     mode is the one a user who never opens settings gets.
--   * notification_sends records counts and a type, never a payload. It exists
--     for the Grafana dashboard, and a metrics table that quietly accumulates
--     medicine names is a health-data leak wearing a monitoring badge.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Mirrors PUSH_PLATFORMS in @nalvita/core.
create type public.push_platform as enum ('ios', 'android', 'web');

-- Mirrors NOTIFICATION_DETAIL_LEVELS in @nalvita/core.
create type public.notification_detail as enum ('generic', 'detailed');

-- ---------------------------------------------------------------------------
-- profiles.notification_detail
--
-- On the profile rather than a settings table: it is one column, and every
-- read of it already happens alongside a profile read.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column notification_detail public.notification_detail not null default 'generic';

-- ---------------------------------------------------------------------------
-- push_tokens
--
-- Keyed on the account (auth.users), not the profile: a device belongs to the
-- person holding it, and a managed profile has no device of its own.
--
-- The token is unique across the table, not per user. The same physical phone
-- handed from one account to another must not end up registered to both, or
-- the previous owner's reminders arrive on it.
-- ---------------------------------------------------------------------------

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique,
  platform public.push_platform not null,
  -- What a person would recognise in a device list ("Pixel 7", "Chrome on
  -- Windows"). Never anything identifying beyond that.
  device_label text,
  -- Refreshed on every app start, so pruning can tell a dormant device from a
  -- dead one without waiting for a send to fail.
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy "Users can view own push tokens" on public.push_tokens
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own push tokens" on public.push_tokens
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own push tokens" on public.push_tokens
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own push tokens" on public.push_tokens
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Deliberately no circle-member policy. A caregiver may read their relative's
-- medicines; they have no business enumerating the devices that relative owns,
-- and nothing in the send path needs it — the Edge Function runs as
-- service_role and looks tokens up itself.

-- ---------------------------------------------------------------------------
-- notification_sends
--
-- Counts and a type. No title, no body, no record id. Sends are logged for the
-- business dashboard, and the dashboard needs "42 reminders went out today",
-- not what any of them said.
-- ---------------------------------------------------------------------------

create table public.notification_sends (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Fixed vocabulary, mirrored by NOTIFICATION_TYPES in @nalvita/core and
  -- enforced in the send function.
  notification_type text not null,
  device_count integer not null default 0,
  delivered_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index notification_sends_created_at_idx on public.notification_sends (created_at desc);

alter table public.notification_sends enable row level security;

-- Read-only to the person it concerns; written only by the send function
-- running as service_role. Nobody edits delivery history, including its owner.
create policy "Users can view own notification sends" on public.notification_sends
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Privileges (KAR-42 — RLS alone is not enough; PostgREST needs the grant)
-- ---------------------------------------------------------------------------

-- Devices are the user's own to manage from the app.
grant select, insert, update, delete on public.push_tokens to authenticated;

-- Delivery history is append-only from the app's point of view, and the app
-- never appends: no INSERT, no UPDATE, no DELETE for authenticated.
grant select on public.notification_sends to authenticated;

grant select, insert, update, delete, truncate on public.push_tokens to service_role;
grant select, insert, update, delete, truncate on public.notification_sends to service_role;
grant usage, select on all sequences in schema public to service_role;
