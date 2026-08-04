import { describe, expect, it } from 'vitest';
import {
  AUDIT_ACTIONS,
  LOGGABLE_AUDIT_ACTIONS,
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

  it('every reference range belongs to a known vital type', () => {
    for (const key of Object.keys(VITAL_REFERENCE_RANGES)) {
      expect(VITAL_TYPES).toContain(key);
    }
  });
});
