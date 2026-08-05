import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

/**
 * Typed stub standing in for `@/lib/supabase` (wired up in test/setup.ts).
 * Tests override individual methods per scenario, e.g.:
 *
 *   vi.mocked(supabase.auth.verifyOtp).mockResolvedValue(...)
 */
export const supabase = {
  auth: {
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    signInWithOtp: vi.fn(async () => ({ data: {}, error: null })),
    verifyOtp: vi.fn(async () => ({ data: {}, error: null })),
    signInWithOAuth: vi.fn(async () => ({ data: {}, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
  },
  from: vi.fn(),
  rpc: vi.fn(),
  storage: { from: vi.fn() },
  // The stub only covers the client surface the app uses; the double cast is
  // the price of not implementing all of SupabaseClient.
} as unknown as SupabaseClient;

/** A signed-in session with obviously fake, non-PII fixture data. */
export function makeSession(): Session {
  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'test.user@example.com',
      aud: 'authenticated',
      role: 'authenticated',
    },
  } as unknown as Session;
}

/** A profiles row as PostgREST would return it; empty (fresh signup) by default. */
export function makeProfileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-0000000000aa',
    user_id: '00000000-0000-4000-8000-000000000001',
    full_name: null,
    date_of_birth: null,
    gender: null,
    blood_group: null,
    height_cm: null,
    weight_kg: null,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Makes `supabase.from('profiles').select().eq().single()` resolve to the given row. */
export function stubProfileSelect(row: Record<string, unknown>) {
  vi.mocked(supabase.from).mockReturnValue({
    select: () => ({
      eq: () => ({
        single: async () => ({ data: row, error: null }),
        maybeSingle: async () => ({ data: row, error: null }),
      }),
    }),
  } as never);
}

/** A documents row as PostgREST would return it. */
export function makeDocumentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-0000000000d1',
    user_id: '00000000-0000-4000-8000-000000000001',
    title: 'Blood test report',
    category: 'lab_report',
    doctor_name: 'City Lab',
    doc_date: '2026-06-01',
    file_path: '00000000-0000-4000-8000-000000000001/aaaa.pdf',
    file_type: 'application/pdf',
    file_size: 123456,
    notes: null,
    created_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * A list builder shaped like the real chain. Every record query is scoped to
 * one profile — `.select('*').eq('user_id', …)` — and from there callers may
 * order, narrow again, or limit in any combination, awaiting whenever they
 * stop. So each link returns the same thenable node rather than a fixed shape.
 */
export function listBuilder(rows: Record<string, unknown>[]) {
  const result = { data: rows, error: null };
  const node = {
    order: () => node,
    eq: () => node,
    limit: () => node,
    then: (resolve: (value: typeof result) => void) => resolve(result),
  };
  return { select: () => node };
}

/** Makes `supabase.from('documents')` resolve its list query to the given rows. */
export function stubDocumentsList(rows: Record<string, unknown>[]) {
  vi.mocked(supabase.from).mockReturnValue(listBuilder(rows) as never);
}

/** A medicines row as PostgREST would return it. */
export function makeMedicineRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-0000000000e1',
    user_id: '00000000-0000-4000-8000-000000000001',
    name: 'Metformin',
    dosage: '500mg',
    frequency: 'twice_daily',
    timings: ['morning', 'night'],
    doctor_name: 'Dr Menon',
    start_date: '2026-06-01',
    end_date: null,
    refill_date: null,
    status: 'active',
    notes: null,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Makes `supabase.from('medicines')` resolve its list query to the given rows. */
export function stubMedicinesList(rows: Record<string, unknown>[]) {
  vi.mocked(supabase.from).mockReturnValue(listBuilder(rows) as never);
}

/** A vitals row as PostgREST would return it (a blood pressure reading by default). */
export function makeVitalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-0000000000f1',
    user_id: '00000000-0000-4000-8000-000000000001',
    type: 'blood_pressure',
    value_1: 128,
    value_2: 84,
    unit: 'mmHg',
    measured_at: '2026-07-20T08:00:00.000Z',
    notes: null,
    created_at: '2026-07-20T08:00:00.000Z',
    ...overrides,
  };
}

/** Makes `supabase.from('vitals')` resolve its list query to the given rows. */
export function stubVitalsList(rows: Record<string, unknown>[]) {
  vi.mocked(supabase.from).mockReturnValue(listBuilder(rows) as never);
}

/** An allergies row as PostgREST would return it. */
export function makeAllergyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-0000000000b1',
    user_id: '00000000-0000-4000-8000-000000000001',
    allergen: 'Penicillin',
    severity: 'severe',
    reaction: 'Rash and swelling',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

/** A conditions row as PostgREST would return it. */
export function makeConditionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-0000000000c1',
    user_id: '00000000-0000-4000-8000-000000000001',
    name: 'Hypertension',
    diagnosis_date: '2020-05-01',
    doctor_name: 'Dr Suresh Pillai',
    status: 'active',
    notes: null,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

/** A doctors row as PostgREST would return it. */
export function makeDoctorRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-0000000000d2',
    user_id: '00000000-0000-4000-8000-000000000001',
    name: 'Dr Suresh Pillai',
    specialty: 'Cardiologist',
    hospital: 'PVS Hospital',
    phone: '+911234567890',
    email: 'clinic@example.com',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

/** A row shaped like `list_circle_people` output (owner-direction by default). */
export function makeCirclePersonRow(overrides: Record<string, unknown> = {}) {
  return {
    membership_id: '00000000-0000-4000-8000-0000000000c9',
    direction: 'owner',
    counterpart_id: '00000000-0000-4000-8000-000000000002',
    counterpart_name: 'Appa',
    role: 'caregiver',
    shared_categories: ['medicines', 'vitals'],
    status: 'active',
    accepted_at: '2026-07-20T08:00:00.000Z',
    revoked_at: null,
    ...overrides,
  };
}

/** A pending invite summary row (no secret hashes), as the owner reads it. */
export function makeInviteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-0000000000a7',
    owner_id: '00000000-0000-4000-8000-000000000001',
    invitee_email: 'appa@example.com',
    requested_role: 'caregiver',
    requested_categories: ['medicines', 'vitals'],
    status: 'pending',
    expires_at: '2026-08-03T08:00:00.000Z',
    created_at: '2026-08-02T08:00:00.000Z',
    responded_at: null,
    ...overrides,
  };
}

/** A consent-preview row as `preview_circle_invite` returns it. */
export function makeInvitePreviewRow(overrides: Record<string, unknown> = {}) {
  return {
    owner_id: '00000000-0000-4000-8000-000000000002',
    owner_name: 'Arjun',
    requested_role: 'caregiver',
    requested_categories: ['medicines', 'vitals'],
    expires_at: '2026-08-03T08:00:00.000Z',
    ...overrides,
  };
}

/** A row shaped like `list_audit_feed` output. */
export function makeAuditFeedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    actor_id: '00000000-0000-4000-8000-000000000002',
    actor_name: 'Appa',
    action: 'viewed',
    resource_type: 'documents',
    resource_id: '00000000-0000-4000-8000-0000000000d1',
    resource_label: 'Blood test report',
    created_at: '2026-08-04T08:00:00.000Z',
    ...overrides,
  };
}

interface TableFixtures {
  profiles?: Record<string, unknown>;
  allergies?: Record<string, unknown>[];
  conditions?: Record<string, unknown>[];
  doctors?: Record<string, unknown>[];
  documents?: Record<string, unknown>[];
  medicines?: Record<string, unknown>[];
  vitals?: Record<string, unknown>[];
}

/**
 * Routes `supabase.from(table)` to the right builder per table, for pages that
 * read several tables at once: `profiles` resolves a single row via
 * `.select().eq().single()`, list tables via `.select().order()`.
 */
export function stubTables(fixtures: TableFixtures) {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'profiles') {
      const row = fixtures.profiles ?? makeProfileRow();
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: row, error: null }),
            maybeSingle: async () => ({ data: row, error: null }),
          }),
        }),
      } as never;
    }
    const rows = (fixtures as Record<string, Record<string, unknown>[]>)[table] ?? [];
    return listBuilder(rows) as never;
  });
}
