import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestUser, deleteTestUsers, type TestUser } from './helpers/clients.js';
import { createActiveMembership } from './helpers/memberships.js';
import { insertPayload } from './helpers/seed.js';

/**
 * Owner-side sharing controls (KAR-45): changing a member's role and the
 * categories they can see, and having it take effect on the very next request.
 *
 * These are plain UPDATEs on circle_memberships — the point of the suite is
 * that the KAR-33 policies and transition trigger allow the owner to make them,
 * that they bind immediately (RLS re-reads the row on every check), and that
 * the member cannot make them for themselves.
 */

let owner: TestUser;
let member: TestUser;
let membershipId: string;

async function setAccess(role: string, categories: string[]) {
  const { error } = await owner.client
    .from('circle_memberships')
    .update({ role, shared_categories: categories })
    .eq('id', membershipId);
  if (error) throw new Error(`Access change failed: ${error.message}`);
}

/** Can the member currently read the owner's medicines? */
async function memberCanReadMedicines(): Promise<boolean> {
  const { data } = await member.client.from('medicines').select('id').eq('profile_id', owner.profileId);
  return (data ?? []).length > 0;
}

beforeAll(async () => {
  owner = await createTestUser('share-owner');
  member = await createTestUser('share-member');

  await owner.client.from('medicines').insert(insertPayload('medicines', owner));
  await owner.client.from('vitals').insert(insertPayload('vitals', owner));

  membershipId = await createActiveMembership(owner, member, 'caregiver', ['medicines', 'vitals']);
});

afterAll(async () => {
  await deleteTestUsers(owner, member);
});

describe('changing a role', () => {
  it('a caregiver can add records on the owner behalf', async () => {
    const { error } = await member.client
      .from('vitals')
      .insert(insertPayload('vitals', owner));
    expect(error).toBeNull();
  });

  it('downgrading to viewer takes effect immediately, with no re-consent', async () => {
    await setAccess('viewer', ['medicines', 'vitals']);

    const { error } = await member.client
      .from('vitals')
      .insert(insertPayload('vitals', owner));
    expect(error?.code).toBe('42501');

    // Reading is untouched by the downgrade.
    expect(await memberCanReadMedicines()).toBe(true);
  });

  it('upgrading again restores what the role allows', async () => {
    await setAccess('caregiver', ['medicines', 'vitals']);

    const { error } = await member.client
      .from('vitals')
      .insert(insertPayload('vitals', owner));
    expect(error).toBeNull();
  });
});

describe('changing shared categories', () => {
  it('removing a category ends access to it immediately', async () => {
    await setAccess('caregiver', ['vitals']);
    expect(await memberCanReadMedicines()).toBe(false);
  });

  it('adding it back restores access', async () => {
    await setAccess('caregiver', ['medicines', 'vitals']);
    expect(await memberCanReadMedicines()).toBe(true);
  });

  it('the wildcard shares everything without listing each category', async () => {
    await setAccess('caregiver', ['all']);

    const { data } = await member.client.from('doctors').select('id').eq('profile_id', owner.profileId);
    expect(data).toEqual([]); // no doctors exist, but the read is permitted

    const { error } = await member.client
      .from('doctors')
      .insert(insertPayload('doctors', owner));
    expect(error).toBeNull();
  });
});

describe('who may change access', () => {
  it('the member cannot widen their own categories', async () => {
    await setAccess('viewer', ['vitals']);

    const { error } = await member.client
      .from('circle_memberships')
      .update({ shared_categories: ['all'] })
      .eq('id', membershipId);
    expect(error).not.toBeNull();

    const { data } = await owner.client
      .from('circle_memberships')
      .select('shared_categories')
      .eq('id', membershipId)
      .single();
    expect(data!.shared_categories).toEqual(['vitals']);
  });

  it('the member cannot promote themselves to manager', async () => {
    const { error } = await member.client
      .from('circle_memberships')
      .update({ role: 'manager' })
      .eq('id', membershipId);
    expect(error).not.toBeNull();
  });
});
