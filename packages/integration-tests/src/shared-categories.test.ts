import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestUser, deleteTestUsers, type TestUser } from './helpers/clients.js';
import { createActiveMembership } from './helpers/memberships.js';
import { insertPayload, seedAllTables, type HealthTable } from './helpers/seed.js';

/**
 * shared_categories scoping: a membership limited to specific table names
 * grants access to those tables only — on every verb, not just select —
 * and 'all' is a wildcard.
 */

let owner: TestUser;
let vitalsViewer: TestUser;
let allViewer: TestUser;
let medsCaregiver: TestUser;

beforeAll(async () => {
  owner = await createTestUser('cat-owner');
  vitalsViewer = await createTestUser('cat-vitals-viewer');
  allViewer = await createTestUser('cat-all-viewer');
  medsCaregiver = await createTestUser('cat-meds-caregiver');

  await createActiveMembership(owner, vitalsViewer, 'viewer', ['vitals']);
  await createActiveMembership(owner, allViewer, 'viewer', ['all']);
  await createActiveMembership(owner, medsCaregiver, 'caregiver', ['medicines']);

  await seedAllTables(owner);
});

afterAll(async () => {
  await deleteTestUsers(owner, vitalsViewer, allViewer, medsCaregiver);
});

describe('viewer scoped to {vitals}', () => {
  it('sees the shared category', async () => {
    const { data } = await vitalsViewer.client
      .from('vitals')
      .select('id')
      .eq('user_id', owner.id);
    expect(data).toHaveLength(1);
  });

  const unshared: HealthTable[] = [
    'profiles',
    'documents',
    'medicines',
    'allergies',
    'conditions',
    'doctors',
  ];

  it.each(unshared)('sees nothing in %s', async (table) => {
    const { data, error } = await vitalsViewer.client
      .from(table)
      .select('id')
      .eq('user_id', owner.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});

describe("viewer with {'all'}", () => {
  it('sees every category', async () => {
    for (const table of ['documents', 'medicines', 'vitals', 'profiles'] as const) {
      const { data } = await allViewer.client.from(table).select('id').eq('user_id', owner.id);
      expect(data, table).toHaveLength(1);
    }
  });
});

describe('caregiver scoped to {medicines}', () => {
  it('can insert into the shared category', async () => {
    const { error } = await medsCaregiver.client
      .from('medicines')
      .insert({ ...insertPayload('medicines', owner.id), name: 'Scopeozil' });
    expect(error).toBeNull();
  });

  it('cannot insert into an unshared category', async () => {
    const { error } = await medsCaregiver.client
      .from('documents')
      .insert(insertPayload('documents', owner.id));
    expect(error?.code).toBe('42501');
  });

  it('cannot read an unshared category', async () => {
    const { data, error } = await medsCaregiver.client
      .from('documents')
      .select('id')
      .eq('user_id', owner.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});
