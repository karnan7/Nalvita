import type { AllergySeverity } from '@nalvita/core';

import { StatusBadge, type StatusVariant } from '@/components/ui-nalvita';
import { ALLERGY_SEVERITY_LABELS } from '@nalvita/data';

/** Health colour semantics: severe → red alert, moderate → amber, mild → green. */
const SEVERITY_VARIANT: Record<AllergySeverity, StatusVariant> = {
  severe: 'critical',
  moderate: 'high',
  mild: 'normal',
};

export function AllergySeverityBadge({ severity }: Readonly<{ severity: AllergySeverity }>) {
  return <StatusBadge variant={SEVERITY_VARIANT[severity]}>{ALLERGY_SEVERITY_LABELS[severity]}</StatusBadge>;
}
