import type { Document, Medicine, Vital } from '@nalvita/core';
import { describe, expect, it } from 'vitest';

import { buildTimeline } from './timeline';

function makeDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: 'd1',
    user_id: 'u1',
    title: 'Blood test',
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
    type: 'blood_pressure',
    value_1: 120,
    value_2: 80,
    unit: 'mmHg',
    measured_at: '2026-07-01T08:00:00.000Z',
    notes: null,
    created_at: '2026-07-01T08:00:00.000Z',
    ...overrides,
  };
}

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

describe('buildTimeline', () => {
  it('merges all three sources newest first', () => {
    const events = buildTimeline([makeDocument()], [makeVital()], [makeMedicine()]);
    expect(events.map((e) => e.kind)).toEqual(['vital', 'document', 'medicine']);
  });

  it('uses a document date over its created_at, falling back when absent', () => {
    const events = buildTimeline(
      [makeDocument({ id: 'd2', doc_date: null, created_at: '2026-08-01T00:00:00.000Z' })],
      [],
      [],
    );
    expect(events[0]?.at).toBe('2026-08-01T00:00:00.000Z');
  });

  it('limits the number of events returned', () => {
    const docs = Array.from({ length: 8 }, (_, i) =>
      makeDocument({ id: `d${i}`, doc_date: `2026-06-0${i + 1}` }),
    );
    expect(buildTimeline(docs, [], [], 5)).toHaveLength(5);
  });

  it('describes a medicine event with its name and dosage', () => {
    const [event] = buildTimeline([], [], [makeMedicine({ name: 'Aspirin', dosage: '75mg' })]);
    expect(event?.title).toBe('Started Aspirin');
    expect(event?.detail).toBe('75mg');
  });
});
