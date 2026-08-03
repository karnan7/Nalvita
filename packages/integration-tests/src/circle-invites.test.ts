import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestUser, deleteTestUsers, type TestUser } from './helpers/clients.js';
import { createInvite } from './helpers/invites.js';
import { revoke } from './helpers/memberships.js';
import { insertPayload } from './helpers/seed.js';

/**
 * The code/link invite lifecycle (KAR-44): accept creates an active membership
 * via the SECURITY DEFINER RPC, while wrong/expired/self attempts leave nothing
 * behind and invitees never get direct read access to invite rows.
 */

let owner: TestUser;
let stranger: TestUser;
const members: TestUser[] = [];

async function newMember(label: string): Promise<TestUser> {
  const member = await createTestUser(label);
  members.push(member);
  return member;
}

beforeAll(async () => {
  owner = await createTestUser('inv-owner');
  stranger = await createTestUser('inv-stranger');
  await owner.client.from('vitals').insert(insertPayload('vitals', owner.id));
});

afterAll(async () => {
  await deleteTestUsers(owner, stranger, ...members);
});

describe('accepting an invite', () => {
  it('creates an active membership and grants access immediately', async () => {
    const member = await newMember('inv-accept');
    const invite = await createInvite(owner, { role: 'caregiver', categories: ['all'] });

    const { error } = await member.client.rpc('accept_circle_invite', { p_secret: invite.token });
    expect(error).toBeNull();

    const { data: vitals } = await member.client
      .from('vitals')
      .select('id')
      .eq('user_id', owner.id);
    expect(vitals).toHaveLength(1);

    const { data: invRow } = await owner.client
      .from('circle_invites')
      .select('status')
      .eq('id', invite.id)
      .single();
    expect(invRow!.status).toBe('accepted');
  });

  it('works from the 6-digit code too', async () => {
    const member = await newMember('inv-code');
    const invite = await createInvite(owner, { role: 'viewer', categories: ['vitals'] });

    const { error } = await member.client.rpc('accept_circle_invite', { p_secret: invite.code });
    expect(error).toBeNull();

    const { data } = await member.client.from('vitals').select('id').eq('user_id', owner.id);
    expect(data).toHaveLength(1);
  });
});

describe('previewing an invite', () => {
  it('discloses who is inviting and exactly what they ask for', async () => {
    const member = await newMember('inv-preview');
    const invite = await createInvite(owner, {
      role: 'caregiver',
      categories: ['medicines', 'vitals'],
    });

    const { data, error } = await member.client.rpc('preview_circle_invite', {
      p_secret: invite.token,
    });
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].owner_id).toBe(owner.id);
    expect(data![0].requested_role).toBe('caregiver');
    expect(data![0].requested_categories).toEqual(['medicines', 'vitals']);
  });
});

describe('invites that should not grant access', () => {
  it('rejects a wrong secret and creates no membership', async () => {
    const member = await newMember('inv-wrong');
    const { error } = await member.client.rpc('accept_circle_invite', {
      p_secret: 'not-a-real-secret',
    });
    expect(error).not.toBeNull();

    const { data } = await member.client.from('vitals').select('id').eq('user_id', owner.id);
    expect(data).toHaveLength(0);
  });

  it('rejects an expired invite', async () => {
    const member = await newMember('inv-expired');
    const invite = await createInvite(owner, {
      role: 'viewer',
      categories: ['all'],
      expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });

    const { error } = await member.client.rpc('accept_circle_invite', { p_secret: invite.token });
    expect(error).not.toBeNull();

    const { data } = await member.client.from('vitals').select('id').eq('user_id', owner.id);
    expect(data).toHaveLength(0);
  });

  it('does not let the owner accept their own invite', async () => {
    const invite = await createInvite(owner, { role: 'viewer', categories: ['all'] });
    const { error } = await owner.client.rpc('accept_circle_invite', { p_secret: invite.token });
    expect(error).not.toBeNull();
  });

  it('leaves nothing behind when declined', async () => {
    const member = await newMember('inv-decline');
    const invite = await createInvite(owner, { role: 'viewer', categories: ['all'] });

    const { error } = await member.client.rpc('decline_circle_invite', { p_secret: invite.token });
    expect(error).toBeNull();

    const { data } = await member.client.from('vitals').select('id').eq('user_id', owner.id);
    expect(data).toHaveLength(0);
  });
});

describe('invite privacy', () => {
  it('does not let a stranger read invite rows directly', async () => {
    const invite = await createInvite(owner, { role: 'viewer', categories: ['all'] });
    const { data } = await stranger.client
      .from('circle_invites')
      .select('id')
      .eq('id', invite.id);
    expect(data).toHaveLength(0);
  });
});

describe('re-inviting after revoke', () => {
  it('reactivates access when a new invite is accepted', async () => {
    const member = await newMember('inv-reinvite');

    const first = await createInvite(owner, { role: 'viewer', categories: ['all'] });
    await member.client.rpc('accept_circle_invite', { p_secret: first.token });

    const { data: membership } = await owner.client
      .from('circle_memberships')
      .select('id')
      .eq('member_id', member.id)
      .single();
    await revoke(owner, membership!.id as string);

    const { data: goneVitals } = await member.client
      .from('vitals')
      .select('id')
      .eq('user_id', owner.id);
    expect(goneVitals).toHaveLength(0);

    const second = await createInvite(owner, { role: 'caregiver', categories: ['all'] });
    const { error } = await member.client.rpc('accept_circle_invite', { p_secret: second.token });
    expect(error).toBeNull();

    const { data: backVitals } = await member.client
      .from('vitals')
      .select('id')
      .eq('user_id', owner.id);
    expect(backVitals).toHaveLength(1);
  });
});
