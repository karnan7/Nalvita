import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * The one way Nalvita sends a push notification (KAR-52).
 *
 * Every notification type — medicine reminders, caregiver alerts, family
 * nudges, accepted invites — comes through here. No feature talks to Expo or
 * FCM directly, so there is exactly one place where "what may a notification
 * say" is decided, and one place to change when that answer changes.
 *
 * ## Who may call it
 *
 * service_role only. Not because sending is dangerous in itself, but because
 * this function sends to an arbitrary `user_id`: anyone who can call it can
 * put text on a stranger's lock screen. The service key never leaves the
 * server (security invariant 1 — it is never in frontend code), so callers are
 * pg_cron jobs and database triggers, never a browser or a phone.
 *
 * A user-initiated notification ("nudge Appa about his tablets") must therefore
 * go through a SECURITY DEFINER RPC that checks circle permission first and
 * calls this from the database side. Handing the browser a service key to save
 * a hop would trade the entire authorization model for convenience.
 *
 * ## What it will not do
 *
 * It will not take the recipient's privacy setting from the caller. The
 * detail level is read from the recipient's own profile row, here, every
 * time. A caller that could pass `detailed: true` would be able to opt someone
 * into having their medicines named on a locked screen, which is precisely the
 * thing the setting exists to prevent.
 */

/**
 * Notification types, mirroring NOTIFICATION_TYPES in @nalvita/core.
 *
 * Deliberately duplicated rather than imported: this runs on Deno in Supabase's
 * edge runtime and cannot resolve a workspace package from the npm monorepo.
 * An integration test posts an unknown type and expects a 400, so the two
 * lists cannot drift apart silently.
 */
const NOTIFICATION_TYPES = [
  'medicine_reminder',
  'caregiver_alert',
  'family_nudge',
  'invite_accepted',
  'test_notification',
] as const;

type NotificationType = (typeof NOTIFICATION_TYPES)[number];

interface SendRequest {
  user_id: string;
  type: NotificationType;
  title: string;
  /** What the notification says when the recipient has opted into detail. */
  body: string;
  /** What it says otherwise. Required — see the note on both being needed. */
  genericBody: string;
  route?: string;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Overridable so tests can point the fan-out at a stub. Without the seam the
 * only way to exercise delivery and token-pruning is to call Expo for real
 * from CI, which is neither reliable nor polite.
 */
const EXPO_PUSH_URL = Deno.env.get('EXPO_PUSH_URL') ?? 'https://exp.host/--/api/v2/push/send';

/** Expo's way of saying the app is gone from that device. */
const UNREGISTERED = 'DeviceNotRegistered';

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

/**
 * Whether the caller holds the service key.
 *
 * The role lives in the JWT's `role` claim. Reading it without verifying the
 * signature would be worthless, so the key is compared directly instead —
 * these are the two forms Supabase issues for server-side callers.
 */
function isServiceRole(authHeader: string | null, serviceKey: string): boolean {
  if (!authHeader?.startsWith('Bearer ')) return false;
  return authHeader.slice('Bearer '.length).trim() === serviceKey;
}

function parseRequest(payload: unknown): SendRequest | string {
  if (typeof payload !== 'object' || payload === null) return 'Body must be a JSON object.';
  const p = payload as Record<string, unknown>;

  for (const field of ['user_id', 'type', 'title', 'body', 'genericBody']) {
    if (typeof p[field] !== 'string' || (p[field] as string).length === 0) {
      return `Missing or empty field: ${field}.`;
    }
  }

  // Every field above is now known to be a non-empty string, so this reads the
  // value back as one rather than stringifying an `unknown`.
  const type = p.type as string;
  if (!NOTIFICATION_TYPES.includes(type as NotificationType)) {
    return `Unknown notification type: ${type}.`;
  }

  if (p.route !== undefined && typeof p.route !== 'string') {
    return 'route must be a string when present.';
  }

  return {
    user_id: p.user_id as string,
    type: p.type as NotificationType,
    title: p.title as string,
    body: p.body as string,
    genericBody: p.genericBody as string,
    route: p.route as string | undefined,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: 'Server is not configured.' }, { status: 500 });
  }

  if (!isServiceRole(req.headers.get('Authorization'), serviceKey)) {
    // Deliberately terse. A caller who is not trusted learns nothing about
    // whether the user_id they guessed exists.
    return Response.json({ error: 'Forbidden.' }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return badRequest('Body must be valid JSON.');
  }

  const parsed = parseRequest(raw);
  if (typeof parsed === 'string') return badRequest(parsed);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // The recipient's own setting, read here rather than trusted from the caller.
  const { data: profile } = await supabase
    .from('profiles')
    .select('notification_detail')
    .eq('user_id', parsed.user_id)
    .maybeSingle();

  // No profile means no consent on record. Fall back to the private wording
  // rather than assuming the permissive one.
  const detailed = profile?.notification_detail === 'detailed';
  const body = detailed ? parsed.body : parsed.genericBody;

  const { data: tokens, error: tokenError } = await supabase
    .from('push_tokens')
    .select('id, token, platform')
    .eq('user_id', parsed.user_id);

  if (tokenError) {
    return Response.json({ error: 'Could not read devices.' }, { status: 500 });
  }

  const devices = tokens ?? [];

  // Web tokens are VAPID/service-worker subscriptions, which the Expo API
  // cannot deliver to. Nothing registers them yet; when web push lands they get
  // their own branch here rather than being quietly dropped.
  const expoDevices = devices.filter((d) => d.platform === 'ios' || d.platform === 'android');

  let delivered = 0;
  let failed = 0;

  if (expoDevices.length > 0) {
    const messages = expoDevices.map((device) => ({
      to: device.token,
      title: parsed.title,
      body,
      // The route is navigation, never a health value — see the payload schema.
      data: parsed.route ? { route: parsed.route } : {},
    }));

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
      });

      const result = (await response.json()) as { data?: ExpoTicket[] };
      const tickets = result.data ?? [];

      const deadTokenIds: string[] = [];
      tickets.forEach((ticket, index) => {
        if (ticket.status === 'ok') {
          delivered += 1;
          return;
        }
        failed += 1;
        // The app has been uninstalled, or the token was reissued. Keeping it
        // means retrying a dead address on every send, forever.
        if (ticket.details?.error === UNREGISTERED) {
          const device = expoDevices[index];
          if (device) deadTokenIds.push(device.id);
        }
      });

      if (deadTokenIds.length > 0) {
        await supabase.from('push_tokens').delete().in('id', deadTokenIds);
      }
    } catch {
      // Expo unreachable: every device this round counts as failed, and the
      // tokens are left alone — an outage is not evidence a device is dead.
      failed += expoDevices.length;
    }
  }

  // Counts and a type. Never the title, the body, or what prompted it.
  await supabase.from('notification_sends').insert({
    user_id: parsed.user_id,
    notification_type: parsed.type,
    device_count: devices.length,
    delivered_count: delivered,
    failed_count: failed,
  });

  // `detail_used` reports which wording won, so the privacy decision is
  // observable to the caller and to tests. It is not an echo of the payload:
  // the caller supplied both strings itself, and no health text goes back.
  return Response.json({
    device_count: devices.length,
    delivered,
    failed,
    detail_used: detailed ? 'detailed' : 'generic',
  });
});
