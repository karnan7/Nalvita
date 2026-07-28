import type { Document, Medicine, Vital } from '@nalvita/core';
import { describe, expect, it } from 'vitest';

import { activeMedicines, lastCheckupDate, latestByVitalType, refillDueCount } from './dashboard';

function makeMedicine(overrides: Partial<Medicine> = {}): Medicine {
  return {
    id: 'm1',
    user_id: 'u1',
    name: 'Metformin',
    dosage: '500mg',
    frequency: 'twice_daily',
    timings: [],
    doctor_name: null,
    start_date: '2026-05-01',
    end_date: null,
    refill_date: null,
    status: 'active',
    notes: null,
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: 'd1',
    user_id: 'u1',
    title: 'Report',
    category: 'lab_report',
    doctor_name: null,
    doc_date: '2026-06-01',
    file_path: 'u1/a.pdf',
    file_type: 'application/pdf',
    file_size: 100,
    notes: null,
    created_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeVital(overrides: Partial<Vital> = {}): Vital {
  return {
    id: 'v1',
    user_id: 'u1',
    type: 'weight',
    value_1: 70,
    value_2: null,
    unit: 'kg',
    measured_at: '2026-07-01T08:00:00.000Z',
    notes: null,
    created_at: '2026-07-01T08:00:00.000Z',
    ...overrides,
  };
}

describe('activeMedicines', () => {
  it('excludes stopped and finished medicines', () => {
    const active = activeMedicines([
      makeMedicine({ id: 'a', status: 'active' }),
      makeMedicine({ id: 'b', status: 'stopped' }),
    ]);
    expect(active.map((m) => m.id)).toEqual(['a']);
  });
});

describe('refillDueCount', () => {
  it('counts active medicines whose refill date is near or overdue', () => {
    const soon = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const count = refillDueCount([
      makeMedicine({ id: 'a', refill_date: soon }),
      makeMedicine({ id: 'b', refill_date: null }),
    ]);
    expect(count).toBe(1);
  });
});

describe('lastCheckupDate', () => {
  it('returns the most recent consultation date', () => {
    const date = lastCheckupDate([
      makeDocument({ id: 'a', category: 'consultation', doc_date: '2026-01-01' }),
      makeDocument({ id: 'b', category: 'consultation', doc_date: '2026-06-15' }),
      makeDocument({ id: 'c', category: 'lab_report', doc_date: '2026-07-01' }),
    ]);
    expect(date).toBe('2026-06-15');
  });

  it('is null when there are no consultations', () => {
    expect(lastCheckupDate([makeDocument({ category: 'lab_report' })])).toBeNull();
  });
});

describe('latestByVitalType', () => {
  it('keeps only the newest reading per type, in display order', () => {
    // Query returns newest-first, so the first match per type is the latest.
    const latest = latestByVitalType([
      makeVital({ id: 'bp-new', type: 'blood_pressure', measured_at: '2026-07-10T00:00:00Z' }),
      makeVital({ id: 'bp-old', type: 'blood_pressure', measured_at: '2026-07-01T00:00:00Z' }),
      makeVital({ id: 'w', type: 'weight' }),
    ]);
    expect(latest.map((v) => v.id)).toEqual(['bp-new', 'w']);
  });
});
