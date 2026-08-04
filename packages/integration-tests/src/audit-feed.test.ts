import { auditFeedEntrySchema } from '@nalvita/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestUser, deleteTestUsers, type TestUser } from './helpers/clients.js';
import { createActiveMembership, revoke } from './helpers/memberships.js';

/**
 * The activity feed's two entry points (KAR-45): log_audit_event() as the only
 * sanctioned way to append, and list_audit_feed() as the owner's read.
 *
 * The invariants that matter: a member cannot invent an action, cannot write
 * about an account or category they have no access to, cannot forge the actor,
 * and cannot read anyone's feed but their own.
 */

let owner: TestUser;
let member: TestUser; // active caregiver on {documents, vitals}
let stranger: TestUser;
let documentId: string;

async function log(
  user: TestUser,
  args: { owner: string; action: string; type: string; id?: string | null },
) {
  return user.client.rpc('log_audit_event', {
    p_owner: args.owner,
    p_action: args.action,
    p_resource_type: args.type,
    p_resource_id: args.id ?? null,
  });
}

async function feed(user: TestUser) {
  const { data, error } = await user.client.rpc('list_audit_feed', {
    p_limit: 50,
    p_before_at: null,
    p_before_id: null,
  });
  if (error) throw new Error(`Feed read failed: ${error.message}`);
  return auditFeedEntrySchema.array().parse(data ?? []);
}

beforeAll(async () => {
  owner = await createTestUser('feed-owner');
  member = await createTestUser('feed-member');
  stranger = await createTestUser('feed-stranger');

  await createActiveMembership(owner, member, 'caregiver', ['documents', 'vitals']);

  const { data, error } = await owner.client
    .from('documents')
    .insert({
      user_id: owner.id,
      title: 'Chest X-ray',
      category: 'xray_scan',
      file_path: `${owner.id}/feed-fixture.pdf`,
      file_type: 'application/pdf',
      file_size: 1024,
    })
    .select('id')
    .single();
  if (error) throw new Error(`Fixture document failed: ${error.message}`);
  documentId = data.id as string;
});

afterAll(async () => {
  await deleteTestUsers(owner, member, stranger);
});

describe('log_audit_event', () => {
  it('records what a member did, as themselves', async () => {
    const { error } = await log(member, {
      owner: owner.id,
      action: 'viewed',
      type: 'documents',
      id: documentId,
    });
    expect(error).toBeNull();

    const entries = await feed(owner);
    const entry = entries.find((e) => e.resource_id === documentId);
    expect(entry?.actor_id).toBe(member.id);
    expect(entry?.action).toBe('viewed');
  });

  it('resolves the record label so the feed can name it', async () => {
    const entries = await feed(owner);
    const entry = entries.find((e) => e.resource_id === documentId);
    expect(entry?.resource_label).toBe('Chest X-ray');
  });

  it('rejects a verb outside the shared vocabulary', async () => {
    const { error } = await log(member, {
      owner: owner.id,
      action: 'deleted_everything',
      type: 'documents',
    });
    expect(error).not.toBeNull();
  });

  it('rejects a resource type that is not a real category', async () => {
    const { error } = await log(member, {
      owner: owner.id,
      action: 'viewed',
      type: 'secrets',
    });
    expect(error).not.toBeNull();
  });

  it('rejects a category the member has no access to', async () => {
    const { error } = await log(member, {
      owner: owner.id,
      action: 'viewed',
      type: 'medicines',
    });
    expect(error).not.toBeNull();
  });

  it('rejects a stranger writing into an account entirely', async () => {
    const { error } = await log(stranger, {
      owner: owner.id,
      action: 'viewed',
      type: 'documents',
    });
    expect(error).not.toBeNull();
  });

  it('ignores actions on your own account rather than filling your own feed', async () => {
    const { error } = await log(owner, {
      owner: owner.id,
      action: 'added',
      type: 'documents',
      id: documentId,
    });
    expect(error).toBeNull();

    const entries = await feed(owner);
    expect(entries.every((e) => e.actor_id !== owner.id)).toBe(true);
  });

  it('stops recording the moment access is revoked', async () => {
    const temp = await createTestUser('feed-temp');
    const membershipId = await createActiveMembership(owner, temp, 'viewer', ['vitals']);

    const { error: allowed } = await log(temp, {
      owner: owner.id,
      action: 'viewed',
      type: 'vitals',
    });
    expect(allowed).toBeNull();

    await revoke(owner, membershipId);

    const { error: denied } = await log(temp, {
      owner: owner.id,
      action: 'viewed',
      type: 'vitals',
    });
    expect(denied).not.toBeNull();

    await deleteTestUsers(temp);
  });
});

describe('list_audit_feed', () => {
  it('shows the owner only their own account', async () => {
    const entries = await feed(owner);
    expect(entries.length).toBeGreaterThan(0);

    const memberFeed = await feed(member);
    expect(memberFeed.every((e) => e.resource_id !== documentId)).toBe(true);
  });

  it('returns newest first and pages without repeating an entry', async () => {
    for (const action of ['viewed', 'updated', 'viewed'] as const) {
      await log(member, { owner: owner.id, action, type: 'documents', id: documentId });
    }

    const all = await feed(owner);
    const times = all.map((e) => new Date(e.created_at).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);

    const { data: firstPage } = await owner.client.rpc('list_audit_feed', {
      p_limit: 2,
      p_before_at: null,
      p_before_id: null,
    });
    const page = auditFeedEntrySchema.array().parse(firstPage ?? []);
    expect(page).toHaveLength(2);
    const cursor = page[1]!;

    const { data: nextPage } = await owner.client.rpc('list_audit_feed', {
      p_limit: 2,
      p_before_at: cursor.created_at,
      p_before_id: cursor.id,
    });
    const next = auditFeedEntrySchema.array().parse(nextPage ?? []);
    expect(next.some((e) => page.some((p) => p.id === e.id))).toBe(false);
  });

  it('leaves the label empty once the record itself is gone', async () => {
    const { data, error } = await owner.client
      .from('vitals')
      .insert({
        user_id: owner.id,
        type: 'weight',
        value_1: 70,
        unit: 'kg',
        measured_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    const vitalId = data!.id as string;

    await log(member, { owner: owner.id, action: 'deleted', type: 'vitals', id: vitalId });
    await owner.client.from('vitals').delete().eq('id', vitalId);

    const entries = await feed(owner);
    const entry = entries.find((e) => e.resource_id === vitalId);
    expect(entry?.resource_label).toBeNull();
  });
});

describe('joining a circle', () => {
  it('appears in the owner’s feed without the app having to log it', async () => {
    const joiner = await createTestUser('feed-joiner');

    const token = 'feed-integration-token';
    const tokenHash = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))),
    )
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const { error: inviteError } = await owner.client.from('circle_invites').insert({
      owner_id: owner.id,
      token_hash: tokenHash,
      code_hash: `${tokenHash}-code`,
      requested_role: 'viewer',
      requested_categories: ['vitals'],
    });
    expect(inviteError).toBeNull();

    const { error: acceptError } = await joiner.client.rpc('accept_circle_invite', {
      p_secret: token,
    });
    expect(acceptError).toBeNull();

    const entries = await feed(owner);
    expect(entries.some((e) => e.actor_id === joiner.id && e.action === 'joined_circle')).toBe(true);

    await deleteTestUsers(joiner);
  });
});
