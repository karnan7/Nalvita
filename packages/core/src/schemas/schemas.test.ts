import { describe, expect, it } from 'vitest';
import { MAX_DOCUMENT_SIZE_BYTES } from '../constants.js';
import { allergyInsertSchema } from './allergy.js';
import { auditEventSchema, auditFeedEntrySchema, auditLogInsertSchema } from './audit-log.js';
import { circleMembershipInviteSchema } from './circle-membership.js';
import { circleInviteInsertSchema, circleInvitePreviewSchema } from './circle-invite.js';
import { conditionInsertSchema } from './condition.js';
import { doctorInsertSchema } from './doctor.js';
import { documentInsertSchema } from './document.js';
import { medicineInsertSchema, medicineSchema } from './medicine.js';
import { profileSchema, profileUpdateSchema } from './profile.js';
import { vitalInsertSchema, vitalSchema } from './vital.js';

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

describe('circleInviteInsertSchema', () => {
  const base = {
    token_hash: 'a'.repeat(64),
    code_hash: 'b'.repeat(64),
  };

  it('defaults to a viewer sharing all categories with no email', () => {
    const result = circleInviteInsertSchema.parse(base);
    expect(result.requested_role).toBe('viewer');
    expect(result.requested_categories).toEqual(['all']);
    expect(result.invitee_email).toBeNull();
  });

  it('rejects a malformed invitee email', () => {
    const result = circleInviteInsertSchema.safeParse({ ...base, invitee_email: 'nope' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown requested category', () => {
    const result = circleInviteInsertSchema.safeParse({
      ...base,
      requested_categories: ['billing'],
    });
    expect(result.success).toBe(false);
  });
});

describe('circleInvitePreviewSchema', () => {
  it('accepts a preview with a null owner name', () => {
    const result = circleInvitePreviewSchema.safeParse({
      owner_id: '11111111-1111-1111-1111-111111111111',
      owner_name: null,
      requested_role: 'caregiver',
      requested_categories: ['medicines', 'vitals'],
      expires_at: '2026-08-03T10:15:30+00:00',
    });
    expect(result.success).toBe(true);
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

describe('profileSchema ownership', () => {
  const base = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    full_name: 'Amma',
    date_of_birth: '1962-04-01',
    gender: 'female',
    blood_group: 'O+',
    height_cm: null,
    weight_kg: null,
    created_at: '2026-08-05T10:00:00+00:00',
    updated_at: '2026-08-05T10:00:00+00:00',
  };

  it('accepts a managed profile, which has no account of its own', () => {
    const result = profileSchema.safeParse({
      ...base,
      user_id: null,
      managed_by: '11111111-1111-1111-1111-111111111111',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a self-managed profile, which has no manager', () => {
    const result = profileSchema.safeParse({
      ...base,
      user_id: '11111111-1111-1111-1111-111111111111',
      managed_by: null,
    });
    expect(result.success).toBe(true);
  });

  it('never lets an update touch who owns the profile', () => {
    const parsed = profileUpdateSchema.parse({
      full_name: 'Amma',
      user_id: '22222222-2222-2222-2222-222222222222',
      managed_by: '22222222-2222-2222-2222-222222222222',
    } as never);
    expect(parsed).not.toHaveProperty('user_id');
    expect(parsed).not.toHaveProperty('managed_by');
  });
});

describe('auditEventSchema', () => {
  const base = {
    owner_id: '11111111-1111-1111-1111-111111111111',
    action: 'viewed',
    resource_type: 'documents',
  };

  it('defaults resource_id to null', () => {
    expect(auditEventSchema.parse(base).resource_id).toBeNull();
  });

  it('rejects a verb outside the shared vocabulary', () => {
    expect(auditEventSchema.safeParse({ ...base, action: 'tampered' }).success).toBe(false);
  });

  it("rejects 'all', which is a permission wildcard and not a record type", () => {
    expect(auditEventSchema.safeParse({ ...base, resource_type: 'all' }).success).toBe(false);
  });
});

describe('auditFeedEntrySchema', () => {
  const entry = {
    id: 12,
    actor_id: '22222222-2222-2222-2222-222222222222',
    actor_name: 'Arjun',
    action: 'viewed',
    resource_type: 'documents',
    resource_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    resource_label: 'Chest X-ray',
    created_at: '2026-08-04T09:15:30+00:00',
  };

  it('accepts a resolved feed entry', () => {
    expect(auditFeedEntrySchema.safeParse(entry).success).toBe(true);
  });

  it('accepts a deleted record, whose label no longer resolves', () => {
    expect(auditFeedEntrySchema.safeParse({ ...entry, resource_label: null }).success).toBe(true);
  });

  it('still parses entries written before the verb vocabulary existed', () => {
    expect(auditFeedEntrySchema.safeParse({ ...entry, action: 'viewed_document' }).success).toBe(
      true,
    );
  });
});

describe('conditionInsertSchema', () => {
  it('accepts a condition with a diagnosis date', () => {
    const result = conditionInsertSchema.safeParse({
      name: 'Hypertension',
      diagnosis_date: '2025-11-20',
      doctor_name: null,
      status: 'managed',
      notes: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown status', () => {
    const result = conditionInsertSchema.safeParse({
      name: 'Hypertension',
      diagnosis_date: null,
      doctor_name: null,
      status: 'cured',
      notes: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('doctorInsertSchema', () => {
  it('accepts a doctor card with contact details', () => {
    const result = doctorInsertSchema.safeParse({
      name: 'Dr. Meera Nair',
      specialty: 'Cardiology',
      hospital: 'City Hospital',
      phone: '+91 98765 43210',
      email: 'clinic@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed email', () => {
    const result = doctorInsertSchema.safeParse({
      name: 'Dr. Meera Nair',
      specialty: null,
      hospital: null,
      phone: null,
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });
});

describe('full-row schemas parse database rows', () => {
  it('medicineSchema accepts a realistic row', () => {
    const result = medicineSchema.safeParse({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      profile_id: '11111111-1111-1111-1111-111111111111',
      name: 'Metformin',
      dosage: '500mg',
      frequency: 'twice_daily',
      timings: ['morning', 'night'],
      doctor_name: null,
      start_date: '2026-07-01',
      end_date: null,
      refill_date: null,
      status: 'active',
      notes: null,
      created_at: '2026-07-08T10:15:30.123456+00:00',
      updated_at: '2026-07-08T10:15:30.123456+00:00',
    });
    expect(result.success).toBe(true);
  });

  it('profileSchema accepts the empty auto-created profile row', () => {
    const result = profileSchema.safeParse({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      user_id: '11111111-1111-1111-1111-111111111111',
      managed_by: null,
      full_name: null,
      date_of_birth: null,
      gender: null,
      blood_group: null,
      height_cm: null,
      weight_kg: null,
      created_at: '2026-07-08T10:15:30+00:00',
      updated_at: '2026-07-08T10:15:30+00:00',
    });
    expect(result.success).toBe(true);
  });

  it('vitalSchema enforces the diastolic rule on full rows too', () => {
    const base = {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      profile_id: '11111111-1111-1111-1111-111111111111',
      type: 'blood_pressure',
      value_1: 118,
      unit: 'mmHg',
      measured_at: '2026-07-08T07:30:00+05:30',
      notes: null,
      created_at: '2026-07-08T10:15:30+00:00',
    };
    expect(vitalSchema.safeParse({ ...base, value_2: 76 }).success).toBe(true);
    expect(vitalSchema.safeParse({ ...base, value_2: null }).success).toBe(false);
  });
});
