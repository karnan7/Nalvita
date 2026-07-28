import { VITAL_TYPES, type Document, type Medicine, type Vital, type VitalType } from '@nalvita/core';

import { isMedicinePast, isRefillDue } from '@/lib/medicines';

/** Medicines currently being taken (not stopped or finished). */
export function activeMedicines(medicines: readonly Medicine[]): Medicine[] {
  return medicines.filter((medicine) => !isMedicinePast(medicine));
}

/** How many active medicines are due for a refill soon. */
export function refillDueCount(medicines: readonly Medicine[]): number {
  return medicines.filter((medicine) => isRefillDue(medicine)).length;
}

/**
 * The date of the most recent consultation document — a stand-in for "last time
 * I saw a doctor". Null when there are no consultations on record.
 */
export function lastCheckupDate(documents: readonly Document[]): string | null {
  const dates = documents
    .filter((doc) => doc.category === 'consultation' && doc.doc_date !== null)
    .map((doc) => doc.doc_date as string)
    .sort((a, b) => b.localeCompare(a));
  return dates[0] ?? null;
}

/**
 * The latest reading of each vital type, in a stable display order. Vitals are
 * already newest-first from the query, so the first match per type wins.
 */
export function latestByVitalType(vitals: readonly Vital[]): Vital[] {
  const latest: Vital[] = [];
  for (const type of VITAL_TYPES as readonly VitalType[]) {
    const reading = vitals.find((vital) => vital.type === type);
    if (reading) latest.push(reading);
  }
  return latest;
}
