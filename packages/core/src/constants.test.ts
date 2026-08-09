import { describe, expect, it } from 'vitest';
import {
  AUDIT_ACTIONS,
  CLAIM_STATUSES,
  INVITE_STATUSES,
  LOGGABLE_AUDIT_ACTIONS,
  MAX_MANAGED_PROFILES,
  SHARE_CATEGORIES,
  VITAL_REFERENCE_RANGES,
  VITAL_TYPES,
} from './constants.js';

// The constants ↔ Postgres mirroring itself is asserted mechanically against
// the live schema in @nalvita/integration-tests (structural.test.ts) and in
// supabase/tests/structural_guards_test.sql. These tests only guard internal
// consistency between the constants.

describe('constants consistency', () => {
  it('share categories are the wildcard plus the seven health table names', () => {
    expect(SHARE_CATEGORIES).toEqual([
      'all',
      'profiles',
      'documents',
      'medicines',
      'vitals',
      'allergies',
      'conditions',
      'doctors',
    ]);
  });

  it('every app-loggable audit action is part of the feed vocabulary', () => {
    for (const action of LOGGABLE_AUDIT_ACTIONS) {
      expect(AUDIT_ACTIONS).toContain(action);
    }
  });

  it('joining a circle is logged by the database, never by the app', () => {
    expect(AUDIT_ACTIONS).toContain('joined_circle');
    expect(LOGGABLE_AUDIT_ACTIONS).not.toContain('joined_circle');
  });

  it('a handover is logged by the database, never by the app', () => {
    expect(AUDIT_ACTIONS).toContain('handed_over_profile');
    expect(LOGGABLE_AUDIT_ACTIONS).not.toContain('handed_over_profile');
  });

  it('the managed-profile cap is a small, deliberate number', () => {
    expect(MAX_MANAGED_PROFILES).toBeGreaterThan(0);
    expect(MAX_MANAGED_PROFILES).toBeLessThanOrEqual(10);
  });

  it('a claim has a state between the two answers it needs', () => {
    expect(CLAIM_STATUSES).toContain('awaiting_manager');
    // Distinct from an invite: an invite is answered once, so it has no such gap.
    expect(INVITE_STATUSES).not.toContain('awaiting_manager');
  });

  it('every reference range belongs to a known vital type', () => {
    for (const key of Object.keys(VITAL_REFERENCE_RANGES)) {
      expect(VITAL_TYPES).toContain(key);
    }
  });
});
