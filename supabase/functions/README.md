# Edge Functions

Serverless functions on Supabase Edge (Deno runtime, free tier: 500k
invocations/month). Phase 1 is pure client → Supabase via RLS and needs none of
these; everything here exists because push notifications (KAR-52) cannot be sent
from a browser or a phone without handing it a key that must never leave a
server.

| Function | Deployed? | What it is |
| --- | --- | --- |
| `send-notification` | yes | The one way Nalvita sends a push notification |
| `expo-stub` | **no — tests only** | A stand-in for Expo's push API so CI can make a send fail on demand |

Create one with `supabase functions new <name>`.

## send-notification

Takes a `user_id` and a payload, looks up that account's devices, fans out to
Expo, prunes tokens Expo reports as dead, and records counts. Every notification
type goes through it. **No feature ever calls Expo or FCM directly** — that is
the whole point of the function existing, and the reason there is exactly one
place where "what may a notification say" is decided.

Two rules it enforces that callers cannot override:

- **service_role only.** It sends to an arbitrary `user_id`, so anyone who can
  call it can put text on a stranger's lock screen. The anon key ships inside
  the web bundle and the app, so it is not enough. A *user*-initiated
  notification ("nudge Appa about his tablets") therefore goes through a
  `SECURITY DEFINER` RPC that checks circle permission first and calls this from
  the database side.
- **The recipient decides the detail level, not the caller.** `profiles.notification_detail`
  is read here, on every send, and defaults to `generic`. A caller passing
  `detailed: true` is ignored — otherwise one feature could opt somebody into
  having their medicines named on a locked screen, which is the exact thing the
  setting exists to prevent. This is why the payload carries **both** `body` and
  `genericBody`: the function picks, the caller supplies.

What it writes to `notification_sends` is a type and three counts. Never a
title, a body, or what prompted it — a metrics table that quietly accumulates
medicine names is a health-data leak wearing a monitoring badge.

### Adding a new notification type

The type vocabulary is fixed and lives in **two** places, deliberately
duplicated: the function runs on Deno inside Supabase's edge runtime and cannot
resolve a workspace package from the npm monorepo.

1. Add the type to `NOTIFICATION_TYPES` in `packages/core/src/constants.ts`.
2. Add the same string to `NOTIFICATION_TYPES` in
   `supabase/functions/send-notification/index.ts`.
3. Call the function from the database side (pg_cron job or `SECURITY DEFINER`
   RPC) with `type` set to the new value, and **both** wordings:

   ```json
   {
     "user_id": "<uuid>",
     "type": "medicine_reminder",
     "title": "Nalvita",
     "body": "Time for your Metformin",
     "genericBody": "Time for your 2pm medicine",
     "route": "/medicines"
   }
   ```

Step 2 is not optional and not silently skippable: `send-notification.test.ts`
imports `NOTIFICATION_TYPES` from `@nalvita/core` and posts every one of them,
expecting each to be accepted, so a type added to core alone fails CI.

Writing the two bodies is the real work, and the generic one is the one that
matters. It must be true and useful while telling a bystander nothing — name a
time, a count, or a section, never a medicine, a condition, or a value.
`genericBody` is required by the schema precisely so nobody can ship a type that
has only the detailed wording and falls back to it.

`route` is navigation and nothing else. It is the only field that reaches the
device's `data` payload, so a record id is acceptable there and a health value
never is.

## Calling it from a schedule

Nothing user-facing can call the function — it takes the service key, which
never leaves a server. The caller is Postgres, through
`notify.send_push_notification(user_id, type, title, body, generic_body, route)`
(migration `20260824213010_scheduled_sends.sql`):

```sql
select cron.schedule(
  'medicine-reminders',
  '* * * * *',
  $$select notify.send_push_notification(
      m.user_id, 'medicine_reminder', 'Nalvita',
      'Time for your ' || m.name, 'Time for your ' || to_char(m.at, 'HH12:MI am') || ' medicine')
    from ... $$
);
```

The function posts asynchronously through `pg_net` and returns a request id;
the reply lands in `net._http_response`, and `cron.job_run_details` records
whether the job itself ran. Both are worth checking when a notification does not
arrive — a job can succeed while the request 403s.

Three deliberate constraints:

- **It lives in the `notify` schema, not `public`.** PostgREST exposes
  `public`, `storage`, and `graphql_public` (`config.toml`), so nothing here is
  reachable over HTTP whatever happens to its grants later.
- **No role may execute it** — not `anon`, not `authenticated`, not
  `service_role`. It sends to an arbitrary `user_id`, so the only callers are
  pg_cron jobs (which run as the owner) and `SECURITY DEFINER` functions that
  have already checked permission. A user-initiated nudge needs its own RPC that
  verifies circle access first, then calls this.
- **It raises rather than returning quietly** when the Vault secrets are
  missing. A silent no-op would mean every scheduled notification going missing
  while cron reported success.

### Deploy step: the two Vault secrets

`send_push_notification` reads its target and its credential from Vault at call
time, because this repo is public and a migration is the last place a service
key may appear. **Nothing sends until these exist** — run once per environment,
in the SQL editor:

```sql
select vault.create_secret(
  'https://<project-ref>.supabase.co/functions/v1/send-notification',
  'nalvita_send_notification_url');
select vault.create_secret('<service-role-key>', 'nalvita_service_role_key');
```

Locally the URL is `http://kong:8000/functions/v1/send-notification` — the
in-cluster address, because `pg_net` runs inside the database container where
`127.0.0.1:54321` is that container rather than the gateway. The integration
suite provisions both secrets itself and removes them afterwards, so local
development needs this only for manual testing.

## Running them locally

Functions are **not** part of `supabase start` — they need a second process:

```sh
supabase start
supabase functions serve --no-verify-jwt --env-file supabase/functions/.env.test
```

`.env.test` is committed on purpose and holds no secret: only the in-cluster
address of `expo-stub`. Without it the send function calls the real Expo API.

Then, from the repo root:

```sh
NALVITA_EXPO_STUB=1 npm run test:integration
```

The suite **skips itself** when nothing is serving on the functions port, rather
than failing — the function is not part of `supabase start`, so a red suite
would only be reporting a missing dev process. That is convenient locally and
dangerous in CI, so `ci.yml` starts the server, polls until it answers, and
fails the job if it never does. Check there before assuming green means run.

`scheduled-sends.test.ts` is the slow one (~13s) and unavoidably so: pg_cron's
finest granularity is a five-second interval and `pg_net` posts
asynchronously, so it schedules a real job and polls. It provisions the Vault
secrets it needs and deletes them in teardown.

The token-pruning tests additionally require `NALVITA_EXPO_STUB=1`. `expo-stub`
picks its reply from the token itself, so a test chooses the outcome by choosing
what to register: a token containing `dead` returns `DeviceNotRegistered` (the
row must be pruned), one containing `broken` returns a different error (the row
must survive — an outage is not evidence a device is gone), anything else
succeeds.

## Deploying

```sh
supabase functions deploy send-notification
```

**Never deploy `expo-stub`.** It is a test double that answers whatever the
caller asks it to; in the hosted project it would be a public endpoint that
fakes delivery. It holds no data, so the risk is silent non-delivery rather than
a leak, but there is no reason for it to exist outside CI.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform.
`EXPO_PUSH_URL` must be left **unset** in the hosted project so the function
defaults to the real Expo API.
