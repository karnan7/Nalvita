-- Registering a device, safely (KAR-52).
--
-- An Expo push token belongs to an app *installation*, not to an account. Sign
-- out and let somebody else sign in on the same phone and the token does not
-- change — so registration has to be able to move a token from one account to
-- another, and RLS deliberately cannot.
--
-- Under the table's own policies the new user can neither UPDATE nor DELETE the
-- previous owner's row (both are gated on `auth.uid() = user_id`, and USING is
-- evaluated against the row as it already is). Left alone, the outcome is the
-- bad one: the INSERT fails on the unique token, the new user silently gets no
-- notifications, and the previous owner's medicine reminders keep arriving on a
-- phone they no longer hold.
--
-- Hence one SECURITY DEFINER entry point. It is narrow on purpose: it can only
-- ever claim a token *for the caller*, so the privilege it holds is exactly
-- "detach this token from whoever had it", and nothing more. It cannot read a
-- token, cannot assign one to a third party, and cannot see anything else.

create or replace function public.register_push_token(
  p_token text,
  p_platform public.push_platform,
  p_device_label text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'Not signed in.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'A push token is required.'
      using errcode = 'check_violation';
  end if;

  -- The device label is a model name ('Pixel 7'), never a device's given name
  -- — those routinely carry a person's name ("Asha's iPhone"), and this row is
  -- readable by anything that can read the table.
  if length(coalesce(p_device_label, '')) > 60 then
    raise exception 'Device label is too long.'
      using errcode = 'check_violation';
  end if;

  -- Whoever held this token no longer has this app installation. Removing the
  -- old row is the whole reason this function is SECURITY DEFINER.
  delete from public.push_tokens where token = p_token and user_id <> caller;

  insert into public.push_tokens (user_id, token, platform, device_label)
  values (caller, p_token, p_platform, p_device_label)
  on conflict (token) do update
    set last_seen_at = now(),
        platform = excluded.platform,
        device_label = excluded.device_label;
end;
$$;

-- Only signed-in callers; the function derives the account from the session, so
-- there is nothing to pass and nothing to forge.
revoke all on function public.register_push_token(text, public.push_platform, text) from public, anon;
grant execute on function public.register_push_token(text, public.push_platform, text) to authenticated;
