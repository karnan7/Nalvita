/**
 * PostgREST-shaped rows for the screens to read.
 *
 * Everything here is obviously fake — no real names, no plausible readings that
 * could be mistaken for someone's data.
 */

const PROFILE_ID = '00000000-0000-4000-8000-0000000000aa';

export function makeDocumentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-0000000000d1',
    profile_id: PROFILE_ID,
    title: 'Blood test report',
    category: 'lab_report',
    doctor_name: 'City Lab',
    doc_date: '2026-06-01',
    file_path: `${PROFILE_ID}/aaaa.pdf`,
    file_type: 'application/pdf',
    file_size: 123456,
    notes: null,
    created_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeMedicineRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-0000000000e1',
    profile_id: PROFILE_ID,
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

export function makeVitalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-0000000000f1',
    profile_id: PROFILE_ID,
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

export function makeAllergyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-0000000000b1',
    profile_id: PROFILE_ID,
    allergen: 'Penicillin',
    severity: 'severe',
    reaction: 'Rash and swelling',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeConditionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-0000000000c1',
    profile_id: PROFILE_ID,
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

export function makeDoctorRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-0000000000d2',
    profile_id: PROFILE_ID,
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
