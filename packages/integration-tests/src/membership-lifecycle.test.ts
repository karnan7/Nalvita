import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestUser, deleteTestUsers, type TestUser } from './helpers/clients.js';
import { accept, invite, revoke } from './helpers/memberships.js';
import { insertPayload } from './helpers/seed.js';

/**
 * The pending → active → revoked lifecycle, enforced by the
 * enforce_membership_transition trigger plus RLS, and the invariant that
 * memberships are revoked, never deleted.
 */

let owner: TestUser;
let member: TestUser;
let stranger: TestUser;
let membershipId: string;

beforeAll(async () => {
  owner = await createTestUser('life-owner');
  member = await createTestUser('life-member');
  stranger = await createTestUser('life-stranger');

  await owner.client.from('vitals').insert(insertPayload('vitals', owner.id));
  membershipId = await invite(owner, member, 'viewer', ['all']);
});

afterAll(async () => {
  await deleteTestUsers(owner, member, stranger);
});

describe('pending', () => {
  it('member can see the invite but no owner data', async () => {
    const { data: memberships } = await member.client
      .from('circle_memberships')
      .select('status')
      .eq('id', membershipId);
    expect(memberships).toHaveLength(1);
    expect(memberships![0]!.status).toBe('pending');

    const { data: vitals } = await member.client
      .from('vitals')
      .select('id')
      .eq('user_id', owner.id);
    expect(vitals).toHaveLength(0);
  });

  it('a stranger cannot see the membership row', async () => {
    const { data } = await stranger.client
      .from('circle_memberships')
      .select('id')
      .eq('id', membershipId);
    expect(data).toHaveLength(0);
  });

  it('member cannot accept and escalate role in the same update', async () => {
    const { error } = await member.client
      .from('circle_memberships')
      .update({ status: 'active', role: 'manager' })
      .eq('id', membershipId);
    expect(error?.code).toBe('P0001');
  });

  it('owner cannot invite themselves', async () => {
    const { error } = await owner.client.from('circle_memberships').insert({
      owner_id: owner.id,
      member_id: owner.id,
      role: 'viewer',
      shared_categories: ['all'],
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe('23514'); // no_self_membership check
  });

  it('owner cannot invite the same member twice', async () => {
    const { error } = await owner.client.from('circle_memberships').insert({
      owner_id: owner.id,
      member_id: member.id,
      role: 'viewer',
      shared_categories: ['all'],
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe('23505'); // unique_pair
  });
});

describe('active', () => {
  it('member accepts and gains access immediately', async () => {
    await accept(member, membershipId);

    const { data } = await member.client.from('vitals').select('id').eq('user_id', owner.id);
    expect(data).toHaveLength(1);
  });

  it('member cannot escalate their own role afterwards', async () => {
    const { error } = await member.client
      .from('circle_memberships')
      .update({ role: 'manager' })
      .eq('id', membershipId);
    expect(error?.code).toBe('P0001');
  });

  it('neither party can delete the membership', async () => {
    const { error: memberError } = await member.client
      .from('circle_memberships')
      .delete()
      .eq('id', membershipId);
    expect(memberError?.code).toBe('42501');

    const { error: ownerError } = await owner.client
      .from('circle_memberships')
      .delete()
      .eq('id', membershipId);
    expect(ownerError?.code).toBe('42501');
  });
});

describe('revoked', () => {
  it('owner revokes; access is lost immediately', async () => {
    await revoke(owner, membershipId);

    const { data } = await member.client.from('vitals').select('id').eq('user_id', owner.id);
    expect(data).toHaveLength(0);
  });

  it('the revoked member cannot re-accept', async () => {
    const { error } = await member.client
      .from('circle_memberships')
      .update({ status: 'active' })
      .eq('id', membershipId);
    expect(error?.code).toBe('P0001');
  });

  it('the owner cannot flip a revoked membership back to active', async () => {
    const { error } = await owner.client
      .from('circle_memberships')
      .update({ status: 'active' })
      .eq('id', membershipId);
    expect(error?.code).toBe('P0001');
  });

  it('the membership row survives as history', async () => {
    const { data } = await owner.client
      .from('circle_memberships')
      .select('status, revoked_at')
      .eq('id', membershipId)
      .single();
    expect(data!.status).toBe('revoked');
    expect(data!.revoked_at).not.toBeNull();
  });
});
