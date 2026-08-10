import type { Condition, Document, Medicine, Vital } from '@nalvita/core';

import { CONDITION_STATUS_LABELS } from './conditions.js';
import { DOCUMENT_CATEGORY_LABELS } from './documents.js';
import { formatVitalValue, VITAL_TYPE_LABELS, VITAL_UNITS } from './vitals.js';

export type TimelineKind = 'document' | 'vital' | 'medicine' | 'condition';

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  /** The clinical date of the event (ISO date or datetime), used for ordering. */
  at: string;
  title: string;
  detail: string | null;
  /** Section route this event links to, when it can be opened. */
  to?: string;
}

/**
 * Merges documents, vitals and medicines into one reverse-chronological feed —
 * the raw material for the dashboard's Timeline card. Each source contributes
 * its most meaningful date (a document's date, a reading's time, a medicine's
 * start), so the feed reflects when things actually happened, not when they
 * were entered.
 */
export function buildTimeline(
  documents: readonly Document[],
  vitals: readonly Vital[],
  medicines: readonly Medicine[],
  limit = 5,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const doc of documents) {
    events.push({
      id: `document-${doc.id}`,
      kind: 'document',
      at: doc.doc_date ?? doc.created_at,
      title: doc.title,
      detail: DOCUMENT_CATEGORY_LABELS[doc.category],
    });
  }

  for (const vital of vitals) {
    events.push({
      id: `vital-${vital.id}`,
      kind: 'vital',
      at: vital.measured_at,
      title: VITAL_TYPE_LABELS[vital.type],
      detail: `${formatVitalValue(vital)} ${VITAL_UNITS[vital.type]}`,
    });
  }

  for (const medicine of medicines) {
    events.push({
      id: `medicine-${medicine.id}`,
      kind: 'medicine',
      at: medicine.start_date,
      title: `Started ${medicine.name}`,
      detail: medicine.dosage,
    });
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return events.slice(0, limit);
}

/** Section route each kind of event opens when tapped. */
const KIND_ROUTES: Record<TimelineKind, string> = {
  document: '/documents',
  vital: '/vitals',
  medicine: '/medicines',
  condition: '/profile',
};

/** The local calendar day (YYYY-MM-DD) an instant falls on, for grouping. */
function dayKey(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function documentEvents(documents: readonly Document[]): TimelineEvent[] {
  return documents.map((doc) => ({
    id: `document-${doc.id}`,
    kind: 'document',
    at: doc.doc_date ?? doc.created_at,
    title: doc.title,
    detail: DOCUMENT_CATEGORY_LABELS[doc.category],
    to: KIND_ROUTES.document,
  }));
}

function medicineEvents(medicines: readonly Medicine[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const medicine of medicines) {
    events.push({
      id: `medicine-start-${medicine.id}`,
      kind: 'medicine',
      at: medicine.start_date,
      title: `Started ${medicine.name}`,
      detail: medicine.dosage,
      to: KIND_ROUTES.medicine,
    });
    if (medicine.end_date) {
      events.push({
        id: `medicine-stop-${medicine.id}`,
        kind: 'medicine',
        at: medicine.end_date,
        title: `Stopped ${medicine.name}`,
        detail: medicine.dosage,
        to: KIND_ROUTES.medicine,
      });
    }
  }
  return events;
}

function conditionEvents(conditions: readonly Condition[]): TimelineEvent[] {
  return conditions.map((condition) => ({
    id: `condition-${condition.id}`,
    kind: 'condition',
    at: condition.diagnosis_date ?? condition.created_at,
    title: `Diagnosed with ${condition.name}`,
    detail: CONDITION_STATUS_LABELS[condition.status],
    to: KIND_ROUTES.condition,
  }));
}

/**
 * Collapses a day's readings into one "Vitals logged" entry so a morning of
 * BP + sugar + weight reads as a single event, not three. The entry is dated
 * at the day's latest reading so it sorts correctly against other events.
 */
function vitalEvents(vitals: readonly Vital[]): TimelineEvent[] {
  // Roll each day up as we go, keeping a running count and the latest reading
  // (which dates the entry) — no post-hoc reduce over a possibly-empty array.
  const byDay = new Map<string, { count: number; latest: Vital }>();
  for (const vital of vitals) {
    const key = dayKey(vital.measured_at);
    const day = byDay.get(key);
    if (!day) {
      byDay.set(key, { count: 1, latest: vital });
    } else {
      day.count += 1;
      if (vital.measured_at >= day.latest.measured_at) day.latest = vital;
    }
  }

  const events: TimelineEvent[] = [];
  for (const [key, { count, latest }] of byDay) {
    const single = count === 1;
    events.push({
      id: `vitals-${key}`,
      kind: 'vital',
      at: latest.measured_at,
      title: single ? VITAL_TYPE_LABELS[latest.type] : 'Vitals logged',
      detail: single
        ? `${formatVitalValue(latest)} ${VITAL_UNITS[latest.type]}`
        : `${count} readings`,
      to: KIND_ROUTES.vital,
    });
  }
  return events;
}

/**
 * The full health history as one reverse-chronological feed for the Timeline
 * page: every document, medicine started/stopped, diagnosis, and daily vitals
 * roll-up, newest first. Unlike {@link buildTimeline} it is unbounded and
 * includes conditions — filtering and pagination happen downstream.
 */
export function buildTimelineEvents(
  documents: readonly Document[],
  vitals: readonly Vital[],
  medicines: readonly Medicine[],
  conditions: readonly Condition[],
): TimelineEvent[] {
  const events = [
    ...documentEvents(documents),
    ...vitalEvents(vitals),
    ...medicineEvents(medicines),
    ...conditionEvents(conditions),
  ];
  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return events;
}

export type TimelineKindFilter = TimelineKind | 'all';

/** Date-range presets, in days back from now; `null` means all time. */
export type TimelineRange = 30 | 90 | 365 | null;

export interface TimelineFilters {
  kind: TimelineKindFilter;
  range: TimelineRange;
}

/** Narrows the feed by event type and date range, preserving order. */
export function filterTimelineEvents(
  events: readonly TimelineEvent[],
  { kind, range }: TimelineFilters,
): TimelineEvent[] {
  const cutoff = range === null ? null : Date.now() - range * 86_400_000;
  return events.filter(
    (event) =>
      (kind === 'all' || event.kind === kind) &&
      (cutoff === null || new Date(event.at).getTime() >= cutoff),
  );
}
