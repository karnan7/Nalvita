import type { CirclePerson, Medicine, Vital } from '@nalvita/core';
import { describe, expect, it } from 'vitest';

import {
  activeMedicineCount,
  attentionsFor,
  sortByAttention,
  type FamilySummary,
} from './family-overview';

const NOW = new Date('2026-08-05T09:00:00.000Z');

function person(overrides: Partial<CirclePerson> = {}): CirclePerson {
  return {
    membership_id: '00000000-0000-4000-8000-0000000000c9',
    direction: 'member',
    counterpart_id: '00000000-0000-4000-8000-000000000002',
    counterpart_name: 'Appa',
    role: 'caregiver',
    shared_categories: ['all'],
    status: 'active',
    accepted_at: '2026-07-20T08:00:00.000Z',
    revoked_at: null,
    ...overrides,
  };
}

function medicine(overrides: Partial<Medicine> = {}): Medicine {
  return {
    id: '00000000-0000-4000-8000-0000000000e1',
    user_id: '00000000-0000-4000-8000-000000000002',
    name: 'Metformin',
    dosage: '500mg',
    frequency: 'twice_daily',
    timings: ['morning', 'night'],
    doctor_name: null,
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

function vital(measuredAt: string): Vital {
  return {
    id: '00000000-0000-4000-8000-0000000000f1',
    user_id: '00000000-0000-4000-8000-000000000002',
    type: 'blood_pressure',
    value_1: 132,
    value_2: 86,
    unit: 'mmHg',
    measured_at: measuredAt,
    notes: null,
    created_at: measuredAt,
  };
}

function summary(attentions: number): FamilySummary {
  return {
    person: person(),
    dateOfBirth: null,
    medicines: null,
    latestVital: null,
    lastCheckup: null,
    attentions: Array.from({ length: attentions }, () => ({
      kind: 'refill-due' as const,
      label: 'x',
    })),
  };
}

describe('attentionsFor', () => {
  it('flags refills coming due, counted in plain words', () => {
    const soon = medicine({ refill_date: '2026-08-06' });
    const attentions = attentionsFor(person(), [soon], vital(NOW.toISOString()), NOW);
    expect(attentions).toEqual([{ kind: 'refill-due', label: '1 refill due' }]);
  });

  it('pluralises when more than one refill is due', () => {
    const meds = [medicine({ refill_date: '2026-08-06' }), medicine({ refill_date: '2026-08-07' })];
    const attentions = attentionsFor(person(), meds, vital(NOW.toISOString()), NOW);
    expect(attentions[0]?.label).toBe('2 refills due');
  });

  it('flags a week with no readings', () => {
    const stale = vital('2026-07-20T08:00:00.000Z');
    const attentions = attentionsFor(person(), [], stale, NOW);
    expect(attentions).toContainEqual({ kind: 'no-recent-vitals', label: 'No readings this week' });
  });

  it('treats never having logged a reading as needing attention too', () => {
    const attentions = attentionsFor(person(), [], null, NOW);
    expect(attentions.map((a) => a.kind)).toEqual(['no-recent-vitals']);
  });

  it('says nothing at all when everything is current', () => {
    const attentions = attentionsFor(person(), [medicine()], vital(NOW.toISOString()), NOW);
    expect(attentions).toEqual([]);
  });

  it('stays silent about vitals it is not allowed to see', () => {
    const medicinesOnly = person({ shared_categories: ['medicines'] });
    const attentions = attentionsFor(medicinesOnly, [medicine()], null, NOW);
    expect(attentions).toEqual([]);
  });
});

describe('sortByAttention', () => {
  it('floats the people who need something to the top', () => {
    const sorted = sortByAttention([summary(0), summary(2), summary(1)]);
    expect(sorted.map((s) => s.attentions.length)).toEqual([2, 1, 0]);
  });
});

describe('activeMedicineCount', () => {
  it('counts only what they are still taking', () => {
    const meds = [medicine(), medicine({ status: 'stopped' })];
    expect(activeMedicineCount(meds)).toBe(1);
  });

  it('is null — not zero — when medicines are not shared', () => {
    expect(activeMedicineCount(null)).toBeNull();
  });
});
