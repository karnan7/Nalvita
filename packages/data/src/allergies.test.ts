import type { Allergy } from '@nalvita/core';
import { describe, expect, it } from 'vitest';

import { sortBySeverity } from './allergies';

function makeAllergy(overrides: Partial<Allergy> = {}): Allergy {
  return {
    id: '00000000-0000-4000-8000-0000000000b1',
    profile_id: '00000000-0000-4000-8000-000000000001',
    allergen: 'Dust',
    severity: 'mild',
    reaction: null,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('sortBySeverity', () => {
  it('orders most serious first', () => {
    const sorted = sortBySeverity([
      makeAllergy({ allergen: 'Dust', severity: 'mild' }),
      makeAllergy({ allergen: 'Penicillin', severity: 'severe' }),
      makeAllergy({ allergen: 'Pollen', severity: 'moderate' }),
    ]);
    expect(sorted.map((a) => a.allergen)).toEqual(['Penicillin', 'Pollen', 'Dust']);
  });

  it('does not mutate the input array', () => {
    const input = [
      makeAllergy({ allergen: 'Dust', severity: 'mild' }),
      makeAllergy({ allergen: 'Penicillin', severity: 'severe' }),
    ];
    sortBySeverity(input);
    expect(input.map((a) => a.allergen)).toEqual(['Dust', 'Penicillin']);
  });
});
