import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, createTestUser, deleteTestUsers, type TestUser } from './helpers/clients.js';
import {
  HEALTH_TABLES,
  insertPayload,
  ownerColumn,
  seedAllTables,
  UPDATE_PROBE,
  type HealthTable,
} from './helpers/seed.js';

/**
 * The owner-only regression check from CLAUDE.md's migration discipline:
 * with zero circle_memberships rows, no other user can see or touch any of
 * the owner's data on any health table, on any verb. Run this after every
 * RLS change.
 */

let owner: TestUser;
let outsider: TestUser;
let seededIds: Record<HealthTable, string>;

beforeAll(async () => {
  owner = await createTestUser('zero-mem-owner');
  outsider = await createTestUser('zero-mem-outsider');
  seededIds = await seedAllTables(owner);
});

afterAll(async () => {
  await deleteTestUsers(owner, outsider);
});

it('precondition: no circle_memberships involve these users', async () => {
  const { data, error } = await admin
    .from('circle_memberships')
    .select('id')
    .or(`owner_id.eq.${owner.profileId},member_id.eq.${owner.id},member_id.eq.${outsider.id}`);
  expect(error).toBeNull();
  expect(data).toHaveLength(0);
});

describe.each([...HEALTH_TABLES])('owner-only behavior on %s', (table) => {
  it('outsider sees zero rows', async () => {
    const { data, error } = await outsider.client
      .from(table)
      .select('*')
      .eq(ownerColumn(table), owner.profileId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('outsider cannot insert a row for the owner', async () => {
    const payload =
      table === 'profiles'
        ? // Claiming to manage a profile you have no business managing is the
          // profiles-table equivalent of inserting a row for someone else.
          { managed_by: owner.id }
        : insertPayload(table, owner);
    const { error } = await outsider.client.from(table).insert(payload);
    expect(error).not.toBeNull();
    expect(error!.code).toBe('42501');
  });

  it("outsider's update silently affects nothing", async () => {
    const probe = UPDATE_PROBE[table];
    const { data, error } = await outsider.client
      .from(table)
      .update({ [probe.column]: probe.value })
      .eq('id', seededIds[table])
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    const { data: ownerView } = await owner.client
      .from(table)
      .select('*')
      .eq('id', seededIds[table])
      .single();
    expect((ownerView as Record<string, unknown>)[probe.column]).not.toBe(probe.value);
  });

  it("outsider's delete silently affects nothing", async () => {
    const { error } = await outsider.client.from(table).delete().eq('id', seededIds[table]);
    expect(error).toBeNull();

    const { data: ownerView } = await owner.client
      .from(table)
      .select('id')
      .eq('id', seededIds[table]);
    expect(ownerView).toHaveLength(1);
  });
});
