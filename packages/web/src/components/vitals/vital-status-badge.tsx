import type { Vital } from '@nalvita/core';

import { statusOf, VITAL_STATUS_CLASSES, VITAL_STATUS_LABELS } from '@/lib/vitals';

/** Weight has no universal reference range, so we don't imply a judgement on it. */
export function VitalStatusBadge({ vital }: Readonly<{ vital: Vital }>) {
  if (vital.type === 'weight') return null;
  const status = statusOf(vital);
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${VITAL_STATUS_CLASSES[status]}`}
    >
      {VITAL_STATUS_LABELS[status]}
    </span>
  );
}
