-- Scheduled sends: the database side of the push pipeline (KAR-52).
--
-- The send Edge Function only accepts service_role, which means the caller has
-- to be something that can hold the service key without exposing it. That rules
-- out the browser and the phone and leaves exactly one place: Postgres itself.
-- This migration is what lets a pg_cron job — and later a permission-checking
-- RPC — reach the function.
--
-- Three deliberate choices here:
--
--   * The service key lives in Vault, never in this file. The repo is public
--     (security invariant 5), so a migration is the last place a credential may
--     appear. The entry point reads the secret at call time and fails loudly if
--     nobody has provisioned it — see the deploy note in
--     supabase/functions/README.md.
--   * The entry point lives in a private `notify` schema, not `public`.
--     PostgREST exposes public/storage/graphql_public (config.toml), so a
--     function here is unreachable over HTTP whatever happens to its grants
--     later. Revoking execute would be enough today; this stays true if
--     somebody grants it back by accident.
--   * It sends to an arbitrary user_id, so nothing user-facing may call it.
--     A user-initiated notification ('nudge Appa about his tablets') belongs
--     behind its own SECURITY DEFINER RPC that checks circle permission first
--     and then calls this. That RPC arrives with KAR-47; this is the pipe.

-- ---------------------------------------------------------------------------
-- Extensions
--
-- Both are already in shared_preload_libraries on Supabase's Postgres image,
-- local and hosted, so this only creates the SQL objects.
-- ---------------------------------------------------------------------------

-- Scheduling. Jobs run as the role that scheduled them, in cron.database_name.
create extension if not exists pg_cron;

-- Outbound HTTP from Postgres, asynchronously: net.http_post queues a request
-- and returns immediately. A synchronous call would hold a cron worker open for
-- the length of an Expo round trip, and a slow third party would become a
-- database problem.
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- notify schema
-- ---------------------------------------------------------------------------

create schema if not exists notify;

-- Not exposed through PostgREST, and not reachable by the API roles even if a
-- future migration puts something else in here.
revoke all on schema notify from public;
revoke all on schema notify from anon, authenticated;

comment on schema notify is
  'Server-side notification plumbing. Never exposed through PostgREST; callers are pg_cron jobs and SECURITY DEFINER functions that have already checked permission.';

-- ---------------------------------------------------------------------------
-- notify.send_push_notification
--
-- The one database-side entry point to the send Edge Function. Returns the
-- pg_net request id so a caller (or a test) can correlate the response in
-- net._http_response.
--
-- Both wordings are required, mirroring the Edge Function's own contract: the
-- caller supplies what the notification would say either way, and the
-- *recipient's* notification_detail setting decides which one is used. The
-- choice is made in the function, from the recipient's profile, so no caller
-- can opt somebody into having their medicines named on a locked screen.
-- ---------------------------------------------------------------------------

create or replace function notify.send_push_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_generic_body text,
  p_route text default null
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets
    where name = 'nalvita_send_notification_url';

  select decrypted_secret into v_key
    from vault.decrypted_secrets
    where name = 'nalvita_service_role_key';

  -- Loud, not silent. A missing secret means every scheduled notification is
  -- quietly not being sent, which is the kind of failure nobody notices until
  -- somebody misses a week of medicine reminders.
  if v_url is null or v_key is null then
    raise exception
      'Notification delivery is not configured: set the nalvita_send_notification_url and nalvita_service_role_key Vault secrets.'
      using errcode = 'config_file_error';
  end if;

  -- jsonb_strip_nulls so an absent route is omitted rather than sent as null —
  -- the Edge Function rejects a route that is present but not a string.
  return net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_strip_nulls(jsonb_build_object(
      'user_id', p_user_id,
      'type', p_type,
      'title', p_title,
      'body', p_body,
      'genericBody', p_generic_body,
      'route', p_route
    )),
    timeout_milliseconds := 10000
  );
end;
$$;

-- SECURITY DEFINER and able to notify anybody, so execute belongs to nobody but
-- the owner. pg_cron jobs run as the role that scheduled them (postgres), which
-- is the owner, so scheduling needs no grant at all.
revoke all on function notify.send_push_notification(uuid, text, text, text, text, text) from public;
revoke all on function notify.send_push_notification(uuid, text, text, text, text, text) from anon, authenticated, service_role;
