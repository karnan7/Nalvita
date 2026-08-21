import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  admin,
  createTestUser,
  deleteTestUsers,
  supabaseAnonKey,
  type TestUser,
} from './helpers/clients.js';
import { getSupabaseTestConfig } from './setup/supabase-config.js';

/**
 * The send-notification Edge Function (KAR-52).
 *
 * Two things are worth proving here and nowhere else: that a caller without
 * the service key cannot put text on somebody's lock screen, and that the
 * recipient's privacy setting decides the wording rather than the caller.
 *
 * These run against `supabase functions serve`. When it is not up the suite
 * skips rather than fails — the function is not part of `supabase start`, so
 * a red suite would only be reporting a missing dev process.
 */

const config = getSupabaseTestConfig();
const FUNCTION_URL = `${config.url}/functions/v1/send-notification`;

let recipient: TestUser;

interface SendResult {
  device_count: number;
  delivered: number;
  failed: number;
  detail_used: 'generic' | 'detailed';
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    user_id: recipient.id,
    type: 'test_notification',
    title: 'Nalvita',
    body: 'Time for your Metformin',
    genericBody: 'Time for your 2pm medicine',
    ...overrides,
  };
}

async function send(body: Record<string, unknown>, authKey: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authKey) headers.Authorization = `Bearer ${authKey}`;
  return fetch(FUNCTION_URL, { method: 'POST', headers, body: JSON.stringify(body) });
}

/** Whose devices and history to look at, as service_role. */
async function sendsFor(userId: string) {
  const { data } = await admin
    .from('notification_sends')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

/**
 * Probed at module scope, not in `beforeAll`: `describe.skipIf` is evaluated
 * while the file is being collected, which happens before any hook runs.
 *
 * An unauthenticated POST is enough — the function answers 403 without
 * touching the database, so this asks "is anything serving?" and nothing more.
 */
const functionAvailable = await (async () => {
  try {
    const probe = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    return probe.status !== 404;
  } catch {
    return false;
  }
})();

beforeAll(async () => {
  recipient = await createTestUser('push-recipient');
  await admin.from('notification_sends').delete().eq('user_id', recipient.id);
});

afterAll(async () => {
  if (recipient) await deleteTestUsers(recipient);
});

describe.skipIf(!functionAvailable)('who may send', () => {
  /**
   * The anon key ships inside the web bundle and the mobile app, so anyone who
   * has ever opened Nalvita has it. It must not be enough to notify a stranger.
   */
  it('refuses the anon key, which every user already holds', async () => {
    const response = await send(payload(), supabaseAnonKey);

    expect(response.status).toBe(403);
  });

  it('refuses a caller with no credentials at all', async () => {
    const response = await send(payload(), null);

    expect(response.status).toBe(403);
  });

  it('accepts the service key, which never leaves the server', async () => {
    const response = await send(payload(), config.serviceRoleKey);

    expect(response.status).toBe(200);
  });

  it('records nothing when the caller was turned away', async () => {
    await admin.from('notification_sends').delete().eq('user_id', recipient.id);

    await send(payload(), supabaseAnonKey);

    expect(await sendsFor(recipient.id)).toHaveLength(0);
  });
});

describe.skipIf(!functionAvailable)('what it will accept', () => {
  it('rejects a notification type no feature declared', async () => {
    const response = await send(payload({ type: 'made_up_type' }), config.serviceRoleKey);

    expect(response.status).toBe(400);
  });

  /**
   * The type list is duplicated into the Deno function because the edge
   * runtime cannot resolve a workspace package. This is the test that stops
   * the two copies drifting apart unnoticed.
   */
  it('accepts every type @nalvita/core declares', async () => {
    for (const type of [
      'medicine_reminder',
      'caregiver_alert',
      'family_nudge',
      'invite_accepted',
      'test_notification',
    ]) {
      const response = await send(payload({ type }), config.serviceRoleKey);
      expect(response.status, `type ${type}`).toBe(200);
    }
  });

  it('refuses a detailed body with no generic wording to fall back to', async () => {
    const response = await send(
      { user_id: recipient.id, type: 'test_notification', title: 'T', body: 'Metformin' },
      config.serviceRoleKey,
    );

    expect(response.status).toBe(400);
  });

  it('rejects a body that is not JSON', async () => {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.serviceRoleKey}`,
      },
      body: 'not json',
    });

    expect(response.status).toBe(400);
  });
});

describe.skipIf(!functionAvailable)('whose privacy setting decides the wording', () => {
  /**
   * The heart of it. A push renders on a locked screen in front of whoever is
   * holding the phone, so naming a medicine there is a disclosure. The choice
   * is made from the recipient's own profile row, every send.
   */
  it('uses the generic wording by default, without anyone opting in', async () => {
    const response = await send(payload(), config.serviceRoleKey);
    const result = (await response.json()) as SendResult;

    expect(result.detail_used).toBe('generic');
  });

  it('uses the detailed wording only once the recipient has chosen it', async () => {
    await admin
      .from('profiles')
      .update({ notification_detail: 'detailed' })
      .eq('user_id', recipient.id);

    const response = await send(payload(), config.serviceRoleKey);
    const result = (await response.json()) as SendResult;

    expect(result.detail_used).toBe('detailed');

    await admin
      .from('profiles')
      .update({ notification_detail: 'generic' })
      .eq('user_id', recipient.id);
  });

  /**
   * A caller that could pass this would be able to opt someone else into
   * having their medicines named on a lock screen.
   */
  it('ignores a detail level the caller tries to force', async () => {
    const response = await send(
      payload({ notification_detail: 'detailed', detailed: true }),
      config.serviceRoleKey,
    );
    const result = (await response.json()) as SendResult;

    expect(result.detail_used).toBe('generic');
  });

  it('falls back to the private wording for a user with no profile row', async () => {
    const response = await send(
      payload({ user_id: '00000000-0000-4000-8000-00000000dead' }),
      config.serviceRoleKey,
    );
    const result = (await response.json()) as SendResult;

    expect(result.detail_used).toBe('generic');
  });
});

describe.skipIf(!functionAvailable)('what it writes down', () => {
  it('logs the send with counts and a type', async () => {
    await admin.from('notification_sends').delete().eq('user_id', recipient.id);

    await send(payload({ type: 'medicine_reminder' }), config.serviceRoleKey);

    const [entry] = await sendsFor(recipient.id);
    expect(entry.notification_type).toBe('medicine_reminder');
    expect(entry.device_count).toBe(0);
  });

  /**
   * The privacy invariant behind the log: it counts sends, it does not
   * remember them. Nothing written here should be readable as health data.
   */
  it('writes nothing that says what the notification was about', async () => {
    await admin.from('notification_sends').delete().eq('user_id', recipient.id);

    await send(payload(), config.serviceRoleKey);

    const [entry] = await sendsFor(recipient.id);
    const serialised = JSON.stringify(entry);
    expect(serialised).not.toContain('Metformin');
    expect(serialised).not.toContain('2pm medicine');
    expect(serialised).not.toContain('Nalvita');
  });

  it('is readable by the person it concerns, and by nobody else', async () => {
    await send(payload(), config.serviceRoleKey);

    const other = await createTestUser('push-onlooker');
    const { data: theirs } = await other.client
      .from('notification_sends')
      .select('*')
      .eq('user_id', recipient.id);
    const { data: mine } = await recipient.client.from('notification_sends').select('*');

    expect(theirs).toHaveLength(0);
    expect((mine ?? []).length).toBeGreaterThan(0);

    await deleteTestUsers(other);
  });

  it('cannot be edited or deleted by the person it concerns', async () => {
    const { error: updateError } = await recipient.client
      .from('notification_sends')
      .update({ delivered_count: 99 })
      .eq('user_id', recipient.id);
    const { error: deleteError } = await recipient.client
      .from('notification_sends')
      .delete()
      .eq('user_id', recipient.id);

    expect(updateError).not.toBeNull();
    expect(deleteError).not.toBeNull();
  });
});
