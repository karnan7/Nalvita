import {
  allergySchema,
  conditionSchema,
  doctorSchema,
  documentSchema,
  medicineSchema,
  profileSchema,
  vitalSchema,
} from '@nalvita/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestUser, deleteTestUsers, type TestUser } from './helpers/clients.js';
import { insertPayload, UPDATE_PROBE, type HealthTable } from './helpers/seed.js';

/**
 * Owner CRUD across every health table, through the same PostgREST + JWT
 * path the web app uses. Responses are parsed with the @nalvita/core row
 * schemas, so this doubles as a check that the schemas mirror the DB.
 */

let owner: TestUser;

beforeAll(async () => {
  owner = await createTestUser('owner-crud');
});

afterAll(async () => {
  await deleteTestUsers(owner);
});

describe('signup trigger', () => {
  it('auto-creates an empty profile for a new user', async () => {
    const { data, error } = await owner.client
      .from('profiles')
      .select('*')
      .eq('user_id', owner.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    const profile = profileSchema.parse(data![0]);
    expect(profile.full_name).toBeNull();
  });

  it('owner can fill in their profile', async () => {
    const { data, error } = await owner.client
      .from('profiles')
      .update({ full_name: 'Test Owner', blood_group: 'O+' })
      .eq('user_id', owner.id)
      .select()
      .single();
    expect(error).toBeNull();
    const profile = profileSchema.parse(data);
    expect(profile.blood_group).toBe('O+');
  });
});

const ROW_SCHEMAS = {
  documents: documentSchema,
  medicines: medicineSchema,
  vitals: vitalSchema,
  allergies: allergySchema,
  conditions: conditionSchema,
  doctors: doctorSchema,
} as const;

describe.each(Object.keys(ROW_SCHEMAS) as Exclude<HealthTable, 'profiles'>[])(
  'owner CRUD on %s',
  (table) => {
    let rowId: string;

    it('inserts a row that parses with the core row schema', async () => {
      const { data, error } = await owner.client
        .from(table)
        .insert(insertPayload(table, owner.id))
        .select()
        .single();
      expect(error).toBeNull();
      const row = ROW_SCHEMAS[table].parse(data);
      expect(row.user_id).toBe(owner.id);
      rowId = row.id;
    });

    it('reads the row back', async () => {
      const { data, error } = await owner.client.from(table).select('*').eq('id', rowId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it('updates the row', async () => {
      const probe = UPDATE_PROBE[table];
      const { data, error } = await owner.client
        .from(table)
        .update({ [probe.column]: probe.value })
        .eq('id', rowId)
        .select()
        .single();
      expect(error).toBeNull();
      expect((data as Record<string, unknown>)[probe.column]).toBe(probe.value);
    });

    it('deletes the row', async () => {
      const { error } = await owner.client.from(table).delete().eq('id', rowId);
      expect(error).toBeNull();
      const { data } = await owner.client.from(table).select('id').eq('id', rowId);
      expect(data).toHaveLength(0);
    });
  },
);
