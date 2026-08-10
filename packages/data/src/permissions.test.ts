import type { CirclePerson, CircleRole, ShareCategory } from '@nalvita/core';
import { describe, expect, it } from 'vitest';

import { allowsCategory, allowsDelete, allowsWrite } from './circle';

function viewing(role: CircleRole, categories: ShareCategory[]): CirclePerson {
  return {
    membership_id: '00000000-0000-4000-8000-0000000000c9',
    direction: 'member',
    counterpart_id: '00000000-0000-4000-8000-000000000002',
    counterpart_name: 'Appa',
    role,
    shared_categories: categories as CirclePerson['shared_categories'],
    status: 'active',
    accepted_at: null,
    revoked_at: null,
  };
}

describe('allowsWrite', () => {
  it('lets me do anything in my own account', () => {
    expect(allowsWrite(null)).toBe(true);
  });

  it("needs caregiver or manager in someone else's", () => {
    expect(allowsWrite(viewing('viewer', ['all']))).toBe(false);
    expect(allowsWrite(viewing('caregiver', ['all']))).toBe(true);
    expect(allowsWrite(viewing('manager', ['all']))).toBe(true);
  });
});

describe('allowsDelete', () => {
  it('is manager-only away from my own account', () => {
    expect(allowsDelete(null)).toBe(true);
    expect(allowsDelete(viewing('viewer', ['all']))).toBe(false);
    expect(allowsDelete(viewing('caregiver', ['all']))).toBe(false);
    expect(allowsDelete(viewing('manager', ['all']))).toBe(true);
  });
});

describe('allowsCategory', () => {
  it('opens every category in my own account', () => {
    expect(allowsCategory(null, 'documents')).toBe(true);
  });

  it('honours the wildcard', () => {
    expect(allowsCategory(viewing('viewer', ['all']), 'documents')).toBe(true);
  });

  it('limits me to what was actually shared', () => {
    const partial = viewing('caregiver', ['medicines', 'vitals']);
    expect(allowsCategory(partial, 'medicines')).toBe(true);
    expect(allowsCategory(partial, 'documents')).toBe(false);
  });
});
