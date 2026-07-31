import type { Vital, VitalStatus } from '@nalvita/core';

import { StatusBadge, type StatusVariant } from '@/components/ui-nalvita';
import { statusOf, VITAL_STATUS_LABELS } from '@/lib/vitals';

/**
 * Maps a vital's clinical status to a Nalvita status colour: normal → green,
 * borderline → amber, low → blue, high → red alert.
 */
const STATUS_VARIANT: Record<VitalStatus, StatusVariant> = {
  normal: 'normal',
  borderline: 'high',
  low: 'low',
  high: 'critical',
};

/** Weight has no universal reference range, so we don't imply a judgement on it. */
export function VitalStatusBadge({ vital }: Readonly<{ vital: Vital }>) {
  if (vital.type === 'weight') return null;
  const status = statusOf(vital);
  return <StatusBadge variant={STATUS_VARIANT[status]}>{VITAL_STATUS_LABELS[status]}</StatusBadge>;
}
