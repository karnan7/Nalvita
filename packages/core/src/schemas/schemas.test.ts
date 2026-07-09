import { describe, expect, it } from 'vitest';
import { MAX_DOCUMENT_SIZE_BYTES } from '../constants.js';
import { calculateAge, getVitalStatus } from '../utils.js';
import { allergyInsertSchema } from './allergy.js';
import { auditLogInsertSchema } from './audit-log.js';
import { circleMembershipInviteSchema } from './circle-membership.js';
import { documentInsertSchema } from './document.js';
import { medicineInsertSchema } from './medicine.js';
import { profileUpdateSchema } from './profile.js';
import { vitalInsertSchema } from './vital.js';

describe('profileUpdateSchema', () => {
  it('accepts a partial profile with a valid blood group', () => {
    const result = profileUpdateSchema.safeParse({
      full_name: 'Adith P A',
      blood_group: 'O+',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid blood group', () => {
    const result = profileUpdateSchema.safeParse({ blood_group: 'C+' });
    expect(result.success).toBe(false);
  });
});

describe('documentInsertSchema', () => {
  const base = {
    title: 'Chest X-ray',
    category: 'xray_scan',
    doctor_name: 'PVS Hospital',
    doc_date: '2026-06-12',
    file_path: 'user-id/chest-xray.pdf',
    file_type: 'application/pdf',
    notes: null,
  };

  it('accepts a file at the 20 MB limit', () => {
    const result = documentInsertSchema.safeParse({ ...base, file_size: MAX_DOCUMENT_SIZE_BYTES });
    expect(result.success).toBe(true);
  });

  it('rejects a file over 20 MB', () => {
    const result = documentInsertSchema.safeParse({
      ...base,
      file_size: MAX_DOCUMENT_SIZE_BYTES + 1,
    });
    expect(result.success).toBe(false);
  });
});

describe('medicineInsertSchema', () => {
  it('defaults status to active and accepts multi-select timings', () => {
    const result = medicineInsertSchema.parse({
      name: 'Metformin',
      dosage: '500mg',
      frequency: 'twice_daily',
      timings: ['morning', 'night'],
      doctor_name: 'Dr. Suresh Pillai',
      start_date: '2026-07-01',
      end_date: null,
      refill_date: null,
      notes: null,
    });
    expect(result.status).toBe('active');
  });
});

describe('vitalInsertSchema', () => {
  it('requires a diastolic value for blood pressure', () => {
    const result = vitalInsertSchema.safeParse({
      type: 'blood_pressure',
      value_1: 128,
      value_2: null,
      unit: 'mmHg',
      measured_at: '2026-07-08T07:30:00+05:30',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a weight reading without value_2', () => {
    const result = vitalInsertSchema.safeParse({
      type: 'weight',
      value_1: 72.5,
      unit: 'kg',
      measured_at: '2026-07-08T07:30:00+05:30',
    });
    expect(result.success).toBe(true);
  });
});

describe('allergyInsertSchema', () => {
  it('rejects an unknown severity', () => {
    const result = allergyInsertSchema.safeParse({
      allergen: 'Penicillin',
      severity: 'fatal',
      reaction: 'Anaphylaxis',
    });
    expect(result.success).toBe(false);
  });
});

describe('circleMembershipInviteSchema', () => {
  it('defaults to a viewer sharing all categories', () => {
    const result = circleMembershipInviteSchema.parse({
      member_id: '22222222-2222-2222-2222-222222222222',
    });
    expect(result.role).toBe('viewer');
    expect(result.shared_categories).toEqual(['all']);
  });

  it('rejects an unknown role', () => {
    const result = circleMembershipInviteSchema.safeParse({
      member_id: '22222222-2222-2222-2222-222222222222',
      role: 'owner',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty shared_categories list', () => {
    const result = circleMembershipInviteSchema.safeParse({
      member_id: '22222222-2222-2222-2222-222222222222',
      shared_categories: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown share category', () => {
    const result = circleMembershipInviteSchema.safeParse({
      member_id: '22222222-2222-2222-2222-222222222222',
      shared_categories: ['billing'],
    });
    expect(result.success).toBe(false);
  });
});

describe('auditLogInsertSchema', () => {
  it('accepts a valid audit entry', () => {
    const result = auditLogInsertSchema.safeParse({
      owner_id: '11111111-1111-1111-1111-111111111111',
      action: 'viewed_document',
      resource_type: 'documents',
      resource_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an entry with an empty action', () => {
    const result = auditLogInsertSchema.safeParse({
      owner_id: '11111111-1111-1111-1111-111111111111',
      action: '',
      resource_type: 'documents',
      resource_id: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('utils', () => {
  it('calculates age from date of birth', () => {
    expect(calculateAge('1990-07-08', new Date('2026-07-08T12:00:00Z'))).toBe(36);
    expect(calculateAge('1990-07-09', new Date('2026-07-08T12:00:00Z'))).toBe(35);
  });

  it('grades blood pressure by the standard reference ranges', () => {
    expect(getVitalStatus('blood_pressure', 118, 76)).toBe('normal');
    expect(getVitalStatus('blood_pressure', 124, 78)).toBe('borderline');
    expect(getVitalStatus('blood_pressure', 132, 84)).toBe('high');
  });

  it('grades fasting blood sugar', () => {
    expect(getVitalStatus('blood_sugar_fasting', 92)).toBe('normal');
    expect(getVitalStatus('blood_sugar_fasting', 110)).toBe('borderline');
    expect(getVitalStatus('blood_sugar_fasting', 130)).toBe('high');
  });
});
