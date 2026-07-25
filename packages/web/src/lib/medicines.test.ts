import type { Medicine } from '@nalvita/core';
import { describe, expect, it } from 'vitest';

import { isMedicinePast, isRefillDue } from './medicines';

const TODAY = '2026-07-25';

function makeMedicine(overrides: Partial<Medicine> = {}): Medicine {
  return {
    id: '00000000-0000-4000-8000-0000000000e1',
    user_id: '00000000-0000-4000-8000-000000000001',
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

describe('isMedicinePast', () => {
  it('treats a stopped medicine as past', () => {
    expect(isMedicinePast(makeMedicine({ status: 'stopped' }), TODAY)).toBe(true);
  });

  it('moves an active medicine to past once its end date has passed', () => {
    expect(isMedicinePast(makeMedicine({ end_date: '2026-07-24' }), TODAY)).toBe(true);
  });

  it('keeps an active medicine with a future end date active', () => {
    expect(isMedicinePast(makeMedicine({ end_date: '2026-07-30' }), TODAY)).toBe(false);
  });

  it('keeps an open-ended active medicine active', () => {
    expect(isMedicinePast(makeMedicine(), TODAY)).toBe(false);
  });
});

describe('isRefillDue', () => {
  it('is due when the refill date is within three days', () => {
    expect(isRefillDue(makeMedicine({ refill_date: '2026-07-28' }), TODAY)).toBe(true);
  });

  it('is not due when the refill date is more than three days away', () => {
    expect(isRefillDue(makeMedicine({ refill_date: '2026-07-29' }), TODAY)).toBe(false);
  });

  it('is still due when the refill date is overdue', () => {
    expect(isRefillDue(makeMedicine({ refill_date: '2026-07-20' }), TODAY)).toBe(true);
  });

  it('is never due without a refill date', () => {
    expect(isRefillDue(makeMedicine(), TODAY)).toBe(false);
  });

  it('is not due once the medicine is past', () => {
    expect(
      isRefillDue(makeMedicine({ status: 'stopped', refill_date: '2026-07-25' }), TODAY),
    ).toBe(false);
  });
});
