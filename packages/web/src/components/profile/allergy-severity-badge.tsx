import type { AllergySeverity } from '@nalvita/core';

import { ALLERGY_SEVERITY_LABELS } from '@/lib/allergies';
import { cn } from '@/lib/utils';

/** Health colour semantics: severe = alert (red), moderate = borderline (amber), mild = calm (green). */
const BADGE_CLASS: Record<AllergySeverity, string> = {
  severe: 'bg-red-100 text-red-800',
  moderate: 'bg-amber-100 text-amber-800',
  mild: 'bg-green-100 text-green-800',
};

export function AllergySeverityBadge({ severity }: Readonly<{ severity: AllergySeverity }>) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-medium',
        BADGE_CLASS[severity],
      )}
    >
      {ALLERGY_SEVERITY_LABELS[severity]}
    </span>
  );
}
