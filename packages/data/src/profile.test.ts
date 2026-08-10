import { describe, expect, it } from 'vitest';

import { computeAge } from './profile';

const TODAY = new Date('2026-07-27T12:00:00');

describe('computeAge', () => {
  it('returns whole years on the birthday', () => {
    expect(computeAge('2000-07-27', TODAY)).toBe(26);
  });

  it('does not count a birthday that has not happened yet this year', () => {
    expect(computeAge('2000-07-28', TODAY)).toBe(25);
  });

  it('counts a birthday earlier in the year as already passed', () => {
    expect(computeAge('2000-07-26', TODAY)).toBe(26);
  });

  it('returns null when the date of birth is unknown', () => {
    expect(computeAge(null, TODAY)).toBeNull();
  });

  it('returns null for a future date of birth', () => {
    expect(computeAge('2030-01-01', TODAY)).toBeNull();
  });
});
