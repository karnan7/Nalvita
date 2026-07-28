import type { Document, Medicine, Vital } from '@nalvita/core';

import { DOCUMENT_CATEGORY_LABELS } from '@/lib/documents';
import { formatVitalValue, VITAL_TYPE_LABELS, VITAL_UNITS } from '@/lib/vitals';

export type TimelineKind = 'document' | 'vital' | 'medicine';

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  /** The clinical date of the event (ISO date or datetime), used for ordering. */
  at: string;
  title: string;
  detail: string | null;
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

  return events
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}
