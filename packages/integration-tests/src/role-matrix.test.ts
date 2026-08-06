import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestUser, deleteTestUsers, type TestUser } from './helpers/clients.js';
import { createActiveMembership } from './helpers/memberships.js';
import { insertPayload } from './helpers/seed.js';

/**
 * The role × verb matrix from CLAUDE.md's authorization model, over real
 * PostgREST clients: viewer reads; caregiver also inserts/updates; manager
 * also deletes. Checked against documents and vitals.
 */

let owner: TestUser;
let viewer: TestUser;
let caregiver: TestUser;
let manager: TestUser;
let documentId: string;
let vitalId: string;

beforeAll(async () => {
  owner = await createTestUser('matrix-owner');
  viewer = await createTestUser('matrix-viewer');
  caregiver = await createTestUser('matrix-caregiver');
  manager = await createTestUser('matrix-manager');

  await createActiveMembership(owner, viewer, 'viewer', ['all']);
  await createActiveMembership(owner, caregiver, 'caregiver', ['all']);
  await createActiveMembership(owner, manager, 'manager', ['all']);

  const { data: doc } = await owner.client
    .from('documents')
    .insert(insertPayload('documents', owner))
    .select('id')
    .single();
  documentId = doc!.id as string;

  const { data: vital } = await owner.client
    .from('vitals')
    .insert(insertPayload('vitals', owner))
    .select('id')
    .single();
  vitalId = vital!.id as string;
});

afterAll(async () => {
  await deleteTestUsers(owner, viewer, caregiver, manager);
});

describe('viewer', () => {
  it('can read the owner documents and vitals', async () => {
    const { data: docs } = await viewer.client
      .from('documents')
      .select('id')
      .eq('profile_id', owner.profileId);
    expect(docs).toHaveLength(1);

    const { data: vitals } = await viewer.client
      .from('vitals')
      .select('id')
      .eq('profile_id', owner.profileId);
    expect(vitals).toHaveLength(1);
  });

  it('cannot insert', async () => {
    const { error } = await viewer.client
      .from('vitals')
      .insert(insertPayload('vitals', owner));
    expect(error?.code).toBe('42501');
  });

  it('cannot update (silently filtered)', async () => {
    const { data, error } = await viewer.client
      .from('documents')
      .update({ title: 'Viewer was here' })
      .eq('id', documentId)
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('cannot delete (row survives)', async () => {
    const { error } = await viewer.client.from('documents').delete().eq('id', documentId);
    expect(error).toBeNull();

    const { data } = await owner.client.from('documents').select('id').eq('id', documentId);
    expect(data).toHaveLength(1);
  });
});

describe('caregiver', () => {
  it('can read', async () => {
    const { data } = await caregiver.client
      .from('documents')
      .select('id')
      .eq('profile_id', owner.profileId);
    expect(data).toHaveLength(1);
  });

  it('can insert on behalf of the owner, and the row belongs to the owner', async () => {
    const { data, error } = await caregiver.client
      .from('vitals')
      .insert({ ...insertPayload('vitals', owner), value_1: 71.0 })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data!.profile_id).toBe(owner.profileId);

    const { data: ownerView } = await owner.client
      .from('vitals')
      .select('id')
      .eq('profile_id', owner.profileId);
    expect(ownerView).toHaveLength(2);
  });

  it('can update', async () => {
    const { data, error } = await caregiver.client
      .from('documents')
      .update({ title: 'Renamed by caregiver' })
      .eq('id', documentId)
      .select()
      .single();
    expect(error).toBeNull();
    expect(data!.title).toBe('Renamed by caregiver');
  });

  it('cannot delete (row survives)', async () => {
    const { error } = await caregiver.client.from('documents').delete().eq('id', documentId);
    expect(error).toBeNull();

    const { data } = await owner.client.from('documents').select('id').eq('id', documentId);
    expect(data).toHaveLength(1);
  });
});

describe('manager', () => {
  it('can read, insert and update', async () => {
    const { data: docs } = await manager.client
      .from('documents')
      .select('id')
      .eq('profile_id', owner.profileId);
    expect(docs).toHaveLength(1);

    const { error: insertError } = await manager.client
      .from('medicines')
      .insert(insertPayload('medicines', owner));
    expect(insertError).toBeNull();

    const { error: updateError } = await manager.client
      .from('vitals')
      .update({ notes: 'checked by manager' })
      .eq('id', vitalId);
    expect(updateError).toBeNull();
  });

  it('can delete, and the row is really gone', async () => {
    const { error } = await manager.client.from('documents').delete().eq('id', documentId);
    expect(error).toBeNull();

    const { data } = await owner.client.from('documents').select('id').eq('id', documentId);
    expect(data).toHaveLength(0);
  });
});
