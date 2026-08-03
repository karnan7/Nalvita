import { describe, expect, it } from 'vitest';

import {
  CIRCLE_ROLE_LABELS,
  describeCategories,
  inviteLink,
  SHARE_CATEGORY_LABELS,
} from '@/lib/circle';

describe('describeCategories', () => {
  it('collapses the wildcard to a plain phrase', () => {
    expect(describeCategories(['all'])).toBe('all your records');
  });

  it('returns a single label as-is', () => {
    expect(describeCategories(['medicines'])).toBe('Medicines');
  });

  it('joins two categories with "and"', () => {
    expect(describeCategories(['medicines', 'vitals'])).toBe('Medicines and Vitals');
  });

  it('comma-separates three or more, with a trailing "and"', () => {
    expect(describeCategories(['medicines', 'vitals', 'documents'])).toBe(
      'Medicines, Vitals and Documents',
    );
  });

  it('handles an empty list', () => {
    expect(describeCategories([])).toBe('');
  });
});

describe('label maps and link', () => {
  it('has a plain-language label for every role', () => {
    expect(CIRCLE_ROLE_LABELS.caregiver).toBe('Can view and add');
    expect(SHARE_CATEGORY_LABELS.all).toBe('All records');
  });

  it('builds an absolute join link carrying the token', () => {
    expect(inviteLink('tok123')).toBe(`${window.location.origin}/family/join?token=tok123`);
  });
});
