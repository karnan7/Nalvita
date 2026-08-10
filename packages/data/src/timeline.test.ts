import type { Condition, Document, Medicine, Vital } from '@nalvita/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildTimeline, buildTimelineEvents, filterTimelineEvents } from './timeline';

function makeDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: 'd1',
    profile_id: 'u1',
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
    profile_id: 'u1',
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
    profile_id: 'u1',
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

function makeCondition(overrides: Partial<Condition> = {}): Condition {
  return {
    id: 'c1',
    profile_id: 'u1',
    name: 'Hypertension',
    diagnosis_date: '2020-05-01',
    doctor_name: 'Dr Pillai',
    status: 'active',
    notes: null,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
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

describe('buildTimelineEvents', () => {
  it('merges every source newest-first with a route to open each record', () => {
    const events = buildTimelineEvents(
      [makeDocument()],
      [makeVital()],
      [makeMedicine()],
      [makeCondition({ diagnosis_date: '2026-08-01' })],
    );
    expect(events.map((e) => e.kind)).toEqual(['condition', 'vital', 'document', 'medicine']);
    expect(events.map((e) => e.to)).toEqual(['/profile', '/vitals', '/documents', '/medicines']);
  });

  it('collapses same-day readings into one "Vitals logged" entry', () => {
    const events = buildTimelineEvents(
      [],
      [
        makeVital({ id: 'v1', type: 'blood_pressure', measured_at: '2026-07-01T06:00:00.000Z' }),
        makeVital({ id: 'v2', type: 'heart_rate', measured_at: '2026-07-01T10:00:00.000Z' }),
      ],
      [],
      [],
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ title: 'Vitals logged', detail: '2 readings' });
    // Dated at the day's latest reading so it sorts correctly.
    expect(events[0]?.at).toBe('2026-07-01T10:00:00.000Z');
  });

  it('keeps a lone reading labelled with its type and value', () => {
    const [event] = buildTimelineEvents([], [makeVital()], [], []);
    expect(event).toMatchObject({ title: 'Blood pressure', detail: '120/80 mmHg' });
  });

  it('emits a stop event only when a medicine has an end date', () => {
    const events = buildTimelineEvents(
      [],
      [],
      [makeMedicine({ name: 'Amlodipine', end_date: '2026-06-15' })],
      [],
    );
    expect(events.map((e) => e.title)).toEqual(['Stopped Amlodipine', 'Started Amlodipine']);
  });

  it('dates a diagnosis by diagnosis_date, falling back to created_at', () => {
    const [event] = buildTimelineEvents(
      [],
      [],
      [],
      [makeCondition({ name: 'Asthma', diagnosis_date: null, created_at: '2026-09-01T00:00:00.000Z' })],
    );
    expect(event).toMatchObject({ title: 'Diagnosed with Asthma', at: '2026-09-01T00:00:00.000Z' });
  });
});

describe('filterTimelineEvents', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T00:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  const events = buildTimelineEvents(
    [makeDocument({ doc_date: '2026-07-20' })],
    [makeVital({ measured_at: '2025-01-01T08:00:00.000Z' })],
    [makeMedicine({ start_date: '2026-07-25' })],
    [],
  );

  it('filters by event type', () => {
    const filtered = filterTimelineEvents(events, { kind: 'medicine', range: null });
    expect(filtered.map((e) => e.kind)).toEqual(['medicine']);
  });

  it('filters by date range, dropping events older than the window', () => {
    const filtered = filterTimelineEvents(events, { kind: 'all', range: 30 });
    expect(filtered.map((e) => e.kind)).toEqual(['medicine', 'document']);
  });

  it('keeps every event when the range is all-time', () => {
    expect(filterTimelineEvents(events, { kind: 'all', range: null })).toHaveLength(3);
  });
});
