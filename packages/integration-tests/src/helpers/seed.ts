import type { TestUser } from './clients.js';

/** The seven health tables guarded by owner-or-circle RLS. */
export const HEALTH_TABLES = [
  'profiles',
  'documents',
  'medicines',
  'vitals',
  'allergies',
  'conditions',
  'doctors',
] as const;

export type HealthTable = (typeof HEALTH_TABLES)[number];

/** Minimal valid insert payload per table (all fixtures obviously fake). */
export function insertPayload(
  table: HealthTable,
  owner: { id: string; profileId: string },
): Record<string, unknown> {
  const profileId = owner.profileId;
  switch (table) {
    case 'profiles':
      // Profiles are auto-created at signup, so an insert here is only ever a
      // managed profile: a person with records but no account of their own.
      return { managed_by: owner.id };
    case 'documents':
      return {
        profile_id: profileId,
        title: 'Test report',
        category: 'lab_report',
        doc_date: '2026-07-01',
        file_path: `${profileId}/test-report.pdf`,
        file_type: 'application/pdf',
        file_size: 1000,
      };
    case 'medicines':
      return {
        profile_id: profileId,
        name: 'Testazol',
        dosage: '10mg',
        frequency: 'once_daily',
        timings: ['morning'],
        start_date: '2026-07-01',
      };
    case 'vitals':
      return {
        profile_id: profileId,
        type: 'weight',
        value_1: 72.5,
        unit: 'kg',
        measured_at: '2026-07-13T08:00:00+05:30',
      };
    case 'allergies':
      return {
        profile_id: profileId,
        allergen: 'Test allergen',
        severity: 'mild',
        reaction: 'Test reaction',
      };
    case 'conditions':
      return {
        profile_id: profileId,
        name: 'Test condition',
        diagnosis_date: '2026-01-01',
      };
    case 'doctors':
      return {
        profile_id: profileId,
        name: 'Dr. Test',
        specialty: 'Testology',
        hospital: 'Test Hospital',
      };
  }
}

/**
 * The column naming a row's owner. A profile *is* the owner, so it answers with
 * its own id; every other health table points at one.
 */
export function ownerColumn(table: HealthTable): 'id' | 'profile_id' {
  return table === 'profiles' ? 'id' : 'profile_id';
}

/** A column safe to overwrite in update tests, per table. */
export const UPDATE_PROBE: Record<HealthTable, { column: string; value: string }> = {
  profiles: { column: 'full_name', value: 'Updated Name' },
  documents: { column: 'title', value: 'Updated title' },
  medicines: { column: 'dosage', value: '20mg' },
  vitals: { column: 'notes', value: 'updated' },
  allergies: { column: 'reaction', value: 'Updated reaction' },
  conditions: { column: 'notes', value: 'updated' },
  doctors: { column: 'hospital', value: 'Updated Hospital' },
};

/**
 * Seeds one row per health table for the owner through their own client
 * (profiles already exists via the signup trigger). Returns row ids by table.
 */
export async function seedAllTables(owner: TestUser): Promise<Record<HealthTable, string>> {
  const ids = {} as Record<HealthTable, string>;

  for (const table of HEALTH_TABLES) {
    if (table === 'profiles') {
      const { data, error } = await owner.client
        .from('profiles')
        .select('id')
        .eq('id', owner.profileId)
        .single();
      if (error) throw new Error(`Seed failed reading auto-profile: ${error.message}`);
      ids.profiles = data.id as string;
      continue;
    }

    const { data, error } = await owner.client
      .from(table)
      .insert(insertPayload(table, owner))
      .select('id')
      .single();
    if (error) throw new Error(`Seed failed inserting into ${table}: ${error.message}`);
    ids[table] = data.id as string;
  }

  return ids;
}
