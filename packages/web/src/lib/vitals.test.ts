import type { Vital } from '@nalvita/core';
import { describe, expect, it } from 'vitest';

import {
  formatVitalValue,
  localFromMeasuredAt,
  measuredAtFromLocal,
  vitalsInWindow,
} from './vitals';

function makeVital(overrides: Partial<Vital> = {}): Vital {
  return {
    id: '00000000-0000-4000-8000-0000000000f1',
    profile_id: '00000000-0000-4000-8000-000000000001',
    type: 'blood_pressure',
    value_1: 128,
    value_2: 84,
    unit: 'mmHg',
    measured_at: '2026-07-20T08:00:00.000Z',
    notes: null,
    created_at: '2026-07-20T08:00:00.000Z',
    ...overrides,
  };
}

describe('formatVitalValue', () => {
  it('joins systolic and diastolic for blood pressure', () => {
    expect(formatVitalValue(makeVital())).toBe('128/84');
  });

  it('shows the single value for other vitals', () => {
    expect(formatVitalValue(makeVital({ type: 'weight', value_1: 72, value_2: null }))).toBe('72');
  });
});

describe('measuredAt local conversion', () => {
  it('round-trips a datetime-local value back to the same wall-clock', () => {
    const local = '2026-07-20T13:45';
    expect(localFromMeasuredAt(measuredAtFromLocal(local))).toBe(local);
  });
});

describe('vitalsInWindow', () => {
  const now = Date.now();
  const iso = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString();

  it('keeps only the requested type within the window, oldest first', () => {
    const vitals = [
      makeVital({ id: 'a', type: 'blood_pressure', measured_at: iso(1) }),
      makeVital({ id: 'b', type: 'blood_pressure', measured_at: iso(10) }),
      makeVital({ id: 'c', type: 'blood_pressure', measured_at: iso(40) }),
      makeVital({ id: 'd', type: 'weight', value_2: null, measured_at: iso(2) }),
    ];
    const result = vitalsInWindow(vitals, 'blood_pressure', 30);
    expect(result.map((v) => v.id)).toEqual(['b', 'a']);
  });
});
