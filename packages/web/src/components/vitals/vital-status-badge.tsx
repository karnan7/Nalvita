import type { Vital } from '@nalvita/core';

import { StatusBadge } from '@/components/ui-nalvita';
import { statusOf, VITAL_STATUS_LABELS, vitalStatusVariant } from '@nalvita/data';

/**
 * The colour mapping and the "don't judge weight" rule both live in
 * `@nalvita/data`, so the phone shows a reading exactly as the browser does.
 */
export function VitalStatusBadge({ vital }: Readonly<{ vital: Vital }>) {
  const variant = vitalStatusVariant(vital);
  if (!variant) return null;
  return <StatusBadge variant={variant}>{VITAL_STATUS_LABELS[statusOf(vital)]}</StatusBadge>;
}
