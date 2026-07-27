import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ALLERGY_SEVERITY_LABELS, sortBySeverity, useAllergies } from '@/lib/allergies';

/**
 * Red alert banner surfacing the person's allergies on the dashboard, most
 * serious first — life-saving context that must be impossible to miss.
 */
export function AllergyBanner() {
  const { data: allergies } = useAllergies();
  const sorted = sortBySeverity(allergies ?? []);
  if (sorted.length === 0) return null;

  return (
    <Link
      to="/profile"
      className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive transition-colors hover:bg-destructive/15"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold">Allergies</p>
        <p className="text-sm">
          {sorted
            .map((allergy) => `${allergy.allergen} (${ALLERGY_SEVERITY_LABELS[allergy.severity]})`)
            .join(', ')}
        </p>
      </div>
    </Link>
  );
}
