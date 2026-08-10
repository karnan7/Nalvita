import { AlertBanner } from '@/components/ui-nalvita';
import { ALLERGY_SEVERITY_LABELS, sortBySeverity, useAllergies } from '@nalvita/data';

/**
 * Red alert banner surfacing the person's allergies on the dashboard, most
 * serious first — life-saving context that must be impossible to miss.
 */
export function AllergyBanner() {
  const { data: allergies } = useAllergies();
  const sorted = sortBySeverity(allergies ?? []);
  if (sorted.length === 0) return null;

  return (
    <AlertBanner title="Allergies" to="/profile">
      {sorted
        .map((allergy) => `${allergy.allergen} (${ALLERGY_SEVERITY_LABELS[allergy.severity]})`)
        .join(', ')}
    </AlertBanner>
  );
}
