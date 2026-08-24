import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, createTestUser, deleteTestUsers, type TestUser } from './helpers/clients.js';
import { getSupabaseTestConfig } from './setup/supabase-config.js';

/**
 * The scheduled-send pipeline, end to end (KAR-52).
 *
 * pg_cron → notify.send_push_notification → pg_net → the send Edge Function →
 * a row in notification_sends. Every other test in this repo exercises one link
 * of that chain; this one exercises the joins, because that is where it breaks:
 * a job that runs as the wrong role, a Vault secret nobody provisioned, an
 * unreachable function URL. All three fail silently in production — nobody
 * notices a reminder that never arrives — so they are worth a slow test.
 *
 * It really is slow: pg_cron's finest granularity is a five-second interval,
 * and pg_net posts asynchronously, so the assertions poll.
 */

const config = getSupabaseTestConfig();
const FUNCTION_URL = `${config.url}/functions/v1/send-notification`;

/**
 * Where Postgres reaches the function from *inside* the docker network.
 *
 * Not the URL the test itself uses: pg_net runs in the database container,
 * where 127.0.0.1:54321 is that container, not the gateway. Same reasoning as
 * EXPO_PUSH_URL in supabase/functions/.env.test.
 */
const IN_CLUSTER_FUNCTION_URL = 'http://kong:8000/functions/v1/send-notification';

const URL_SECRET = 'nalvita_send_notification_url';
const KEY_SECRET = 'nalvita_service_role_key';
const JOB_NAME = 'nalvita-scheduled-send-test';

/** Only tokens the stub recognises; see supabase/functions/expo-stub. */
const STUB_OK_TOKEN = 'ExponentPushToken[scheduled-send-ok]';

const usingExpoStub = process.env.NALVITA_EXPO_STUB === '1';

let db: Client;
let recipient: TestUser;

/**
 * Probed at module scope: `describe.skipIf` is evaluated during collection,
 * before any hook runs. An unauthenticated POST is enough — the function
 * answers 403 without touching the database.
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

async function setSecret(name: string, secret: string): Promise<void> {
  // create_secret rejects a duplicate name, and a previous run may have left
  // one behind, so this is delete-then-create rather than an upsert.
  await db.query('delete from vault.secrets where name = $1', [name]);
  await db.query('select vault.create_secret($1, $2)', [secret, name]);
}

async function unschedule(): Promise<void> {
  await db.query(
    `select cron.unschedule(jobid) from cron.job where jobname = $1`,
    [JOB_NAME],
  );
}

/**
 * Provisions the secrets and schedules the send on the shortest interval
 * pg_cron allows.
 *
 * The recipient's uuid is interpolated rather than bound: pg_cron stores the
 * job body as text, so there is no statement to bind a parameter to. The value
 * comes from Supabase's admin API, so it is a real uuid rather than anything a
 * caller chose.
 */
async function scheduleSend(userId: string, route?: string): Promise<void> {
  await setSecret(URL_SECRET, IN_CLUSTER_FUNCTION_URL);
  await setSecret(KEY_SECRET, config.serviceRoleKey);

  const args = [
    `'${userId}'::uuid`,
    `'test_notification'`,
    `'Nalvita'`,
    `'Time for your Metformin'`,
    `'Time for your 2pm medicine'`,
    ...(route ? [`'${route}'`] : []),
  ].join(', ');

  await db.query(`select cron.schedule($1, '5 seconds', $2)`, [
    JOB_NAME,
    `select notify.send_push_notification(${args})`,
  ]);
}

/** Waits for a condition, polling. Returns false if it never became true. */
async function waitFor(check: () => Promise<boolean>, timeoutMs = 45_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

async function sendsFor(userId: string) {
  const { data } = await admin
    .from('notification_sends')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

beforeAll(async () => {
  db = new Client({ connectionString: config.dbUrl });
  await db.connect();
  recipient = await createTestUser('scheduled-send');
});

afterAll(async () => {
  // Order matters: the job must stop before the user it notifies is deleted,
  // or a stray tick writes a notification_sends row against a dead user_id.
  if (db) {
    await unschedule();
    await db.query('delete from vault.secrets where name in ($1, $2)', [URL_SECRET, KEY_SECRET]);
  }
  if (recipient) await deleteTestUsers(recipient);
  if (db) await db.end();
});

describe.skipIf(!functionAvailable)('a scheduled job reaches the send function', () => {
  let response: { status_code: number; content: string } | undefined;

  beforeAll(async () => {
    await scheduleSend(recipient.id, '/medicines');

    await waitFor(async () => (await sendsFor(recipient.id)).length > 0);

    // Stop before asserting: at five-second ticks the counts keep moving.
    await unschedule();

    const { rows } = await db.query<{ status_code: number; content: string }>(
      `select r.status_code, r.content
         from net._http_response r
        where r.content like '%' || $1 || '%' or r.status_code >= 400
        order by r.id desc limit 1`,
      ['detail_used'],
    );
    response = rows[0];
  }, 90_000);

  it('records the send, so the job actually ran', async () => {
    const sends = await sendsFor(recipient.id);
    expect(sends.length).toBeGreaterThan(0);
    expect(sends[0].notification_type).toBe('test_notification');
  });

  it('reports the job as succeeded rather than failing quietly', async () => {
    const { rows } = await db.query<{ status: string; return_message: string }>(
      `select d.status, d.return_message
         from cron.job_run_details d
        where d.command like '%send_push_notification%'
        order by d.start_time desc limit 1`,
    );
    expect(rows[0]?.status).toBe('succeeded');
  });

  it('was accepted by the function, not turned away as an untrusted caller', () => {
    // A 403 here would mean the Vault service key never reached the header —
    // the pipeline's most likely misconfiguration, and invisible from the
    // notification_sends side because no row is written at all.
    expect(response?.status_code).toBe(200);
  });

  it('used the recipient’s privacy default, not the caller’s wording', () => {
    // Nobody opted this user into detail, so the generic body must win — the
    // same rule the function applies to a direct call, proven through cron.
    expect(response?.content).toContain('"detail_used":"generic"');
  });
});

describe.skipIf(!functionAvailable || !usingExpoStub)('a scheduled send reaches a device', () => {
  /**
   * Gated on the stub: without it the fan-out would post a made-up token to
   * the real Expo API. The zero-device case above proves the pipeline; this
   * proves the last hop.
   */
  it('counts the device it delivered to', async () => {
    await admin.from('notification_sends').delete().eq('user_id', recipient.id);
    await admin.from('push_tokens').insert({
      user_id: recipient.id,
      token: STUB_OK_TOKEN,
      platform: 'android',
      device_label: 'Pixel 7',
    });

    await scheduleSend(recipient.id);

    const arrived = await waitFor(async () => {
      const sends = await sendsFor(recipient.id);
      return sends.length > 0 && sends[0].device_count > 0;
    });
    await unschedule();

    expect(arrived).toBe(true);
    const sends = await sendsFor(recipient.id);
    expect(sends[0].device_count).toBe(1);
    expect(sends[0].delivered_count).toBe(1);
    expect(sends[0].failed_count).toBe(0);

    await admin.from('push_tokens').delete().eq('token', STUB_OK_TOKEN);
  }, 90_000);
});

describe('configuration', () => {
  /**
   * The failure this guards against is the quiet one. With no secret the
   * function could plausibly return without posting, and every scheduled
   * notification would go missing while cron reported success.
   */
  it('refuses to send when nobody has provisioned the Vault secrets', async () => {
    await db.query('delete from vault.secrets where name in ($1, $2)', [URL_SECRET, KEY_SECRET]);

    await expect(
      db.query(
        `select notify.send_push_notification(
           $1::uuid, 'test_notification', 'Nalvita', 'detailed', 'generic')`,
        [recipient.id],
      ),
    ).rejects.toThrow(/not configured/i);
  });

  it('is not reachable through PostgREST, only from inside the database', async () => {
    // notify is absent from config.toml's exposed schemas, so PostgREST does
    // not know the function exists. Belt and braces with the pgTAP grant
    // assertions: this is the check that would catch someone adding 'notify'
    // to that list.
    const { error } = await admin.rpc('send_push_notification', {
      p_user_id: recipient.id,
      p_type: 'test_notification',
      p_title: 'Nalvita',
      p_body: 'detailed',
      p_generic_body: 'generic',
    });
    expect(error).not.toBeNull();
  });
});
