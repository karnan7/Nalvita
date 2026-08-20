import {
  ALLERGY_SEVERITIES,
  BLOOD_GROUPS,
  CIRCLE_ROLES,
  CLAIM_STATUSES,
  CONDITION_STATUSES,
  DOCUMENT_CATEGORIES,
  DOCUMENT_MIME_TYPES,
  GENDERS,
  INVITE_STATUSES,
  MAX_DOCUMENT_SIZE_BYTES,
  MEDICINE_FREQUENCIES,
  MEDICINE_STATUSES,
  MEDICINE_TIMINGS,
  MEMBERSHIP_STATUSES,
  NOTIFICATION_DETAIL_LEVELS,
  PUSH_PLATFORMS,
  VITAL_TYPES,
} from '@nalvita/core';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin } from './helpers/clients.js';
import { getSupabaseTestConfig } from './setup/supabase-config.js';

/**
 * core ↔ database drift guards. The enum arrays in constants.ts and the
 * Postgres enums / check constraints are maintained by hand in four places
 * (CLAUDE.md schema pattern); these tests compare them mechanically so a
 * change on either side fails CI until all four are updated together.
 *
 * Uses a direct (localhost-only) Postgres connection: system catalogs are
 * not exposed through PostgREST.
 */

let db: Client;

beforeAll(async () => {
  db = new Client({ connectionString: getSupabaseTestConfig().dbUrl });
  await db.connect();
});

afterAll(async () => {
  await db.end();
});

describe('Postgres enums mirror constants.ts', () => {
  const EXPECTED_ENUMS: Record<string, readonly string[]> = {
    blood_group: BLOOD_GROUPS,
    circle_role: CIRCLE_ROLES,
    claim_status: CLAIM_STATUSES,
    invite_status: INVITE_STATUSES,
    membership_status: MEMBERSHIP_STATUSES,
    notification_detail: NOTIFICATION_DETAIL_LEVELS,
    push_platform: PUSH_PLATFORMS,
  };

  it('every public enum matches its constants array, and none is missing', async () => {
    const { rows } = await db.query<{ typname: string; labels: string[] }>(
      `select t.typname, array_agg(e.enumlabel order by e.enumsortorder)::text[] as labels
       from pg_type t
       join pg_enum e on e.enumtypid = t.oid
       join pg_namespace n on n.oid = t.typnamespace
       where n.nspname = 'public'
       group by t.typname`,
    );

    const actual = Object.fromEntries(rows.map((r) => [r.typname, r.labels]));
    expect(Object.keys(actual).sort()).toEqual(Object.keys(EXPECTED_ENUMS).sort());
    for (const [name, expected] of Object.entries(EXPECTED_ENUMS)) {
      expect(actual[name], `enum ${name}`).toEqual([...expected]);
    }
  });
});

describe('check-constraint value lists mirror constants.ts', () => {
  // Postgres auto-names single-column checks <table>_<column>_check.
  const EXPECTED_CHECKS: Record<string, readonly string[]> = {
    profiles_gender_check: GENDERS,
    documents_category_check: DOCUMENT_CATEGORIES,
    medicines_frequency_check: MEDICINE_FREQUENCIES,
    medicines_timings_check: MEDICINE_TIMINGS,
    medicines_status_check: MEDICINE_STATUSES,
    vitals_type_check: VITAL_TYPES,
    allergies_severity_check: ALLERGY_SEVERITIES,
    conditions_status_check: CONDITION_STATUSES,
  };

  async function constraintDef(name: string): Promise<string> {
    const { rows } = await db.query<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint where conname = $1`,
      [name],
    );
    expect(rows, `constraint ${name} exists`).toHaveLength(1);
    return rows[0]!.def;
  }

  it.each(Object.entries(EXPECTED_CHECKS))('%s', async (name, expected) => {
    const def = await constraintDef(name);
    const literals = [...def.matchAll(/'([^']*)'/g)].map((m) => m[1]);
    expect([...literals].sort()).toEqual([...expected].sort());
  });

  it('documents file_size limit matches MAX_DOCUMENT_SIZE_BYTES', async () => {
    // The stored definition keeps the unevaluated `20 * 1024 * 1024`
    // expression, so evaluate the constraint at the boundary instead:
    // exactly MAX passes, MAX + 1 fails.
    const def = await constraintDef('documents_file_size_check');
    const expr = def.replace(/^CHECK\s*/, '');

    const atLimit = await db.query<{ ok: boolean }>(
      `select ${expr.replaceAll('file_size', String(MAX_DOCUMENT_SIZE_BYTES))} as ok`,
    );
    expect(atLimit.rows[0]!.ok).toBe(true);

    const overLimit = await db.query<{ ok: boolean }>(
      `select ${expr.replaceAll('file_size', String(MAX_DOCUMENT_SIZE_BYTES + 1))} as ok`,
    );
    expect(overLimit.rows[0]!.ok).toBe(false);
  });
});

describe('bucket config mirrors constants.ts', () => {
  it('health-documents limits match core constants', async () => {
    const { data, error } = await admin.storage.getBucket('health-documents');
    expect(error).toBeNull();
    expect(data!.public).toBe(false);
    expect(data!.file_size_limit).toBe(MAX_DOCUMENT_SIZE_BYTES);
    expect(data!.allowed_mime_types).toEqual([...DOCUMENT_MIME_TYPES]);
  });
});

describe('policy guards', () => {
  it('RLS is enabled on every table in public', async () => {
    const { rows } = await db.query<{ tablename: string }>(
      `select tablename from pg_tables where schemaname = 'public' and not rowsecurity`,
    );
    expect(rows.map((r) => r.tablename)).toEqual([]);
  });

  it('no health-table policy applies to any role but authenticated', async () => {
    const { rows } = await db.query<{ tablename: string; policyname: string }>(
      `select tablename, policyname from pg_policies
       where schemaname = 'public'
         and tablename in ('profiles', 'documents', 'medicines', 'vitals',
                           'allergies', 'conditions', 'doctors')
         and roles <> '{authenticated}'::name[]`,
    );
    expect(rows).toEqual([]);
  });
});
