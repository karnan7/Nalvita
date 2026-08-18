import type { Vital } from '@nalvita/core';
import { statusOf, VITAL_STATUS_LABELS, vitalStatusVariant } from '@nalvita/data';

import { StatusBadge } from '@/components/ui';

/**
 * A reading's status pill — or nothing at all for weight, which has no
 * universal healthy range. Both the colour mapping and that rule come from
 * `@nalvita/data`, so a reading looks the same here as it does in the browser.
 */
export function VitalBadge({ vital }: Readonly<{ vital: Vital }>) {
  const variant = vitalStatusVariant(vital);
  if (!variant) return null;
  return <StatusBadge variant={variant}>{VITAL_STATUS_LABELS[statusOf(vital)]}</StatusBadge>;
}
