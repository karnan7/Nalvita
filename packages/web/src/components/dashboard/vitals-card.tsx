import { CardSkeleton, EmptyState, SectionCard } from '@/components/ui-nalvita';
import { VitalStatusBadge } from '@/components/vitals/vital-status-badge';
import { VITAL_TYPE_LABELS, VITAL_UNITS, formatVitalValue, latestByVitalType, useVitals } from '@nalvita/data';

export function VitalsCard() {
  const { data: vitals, isPending, isError } = useVitals();
  const latest = latestByVitalType(vitals ?? []);

  return (
    <SectionCard title="Vitals — last reading" seeAllTo="/vitals">
      {isPending && <CardSkeleton />}
      {isError && <EmptyState>We couldn't load your vitals.</EmptyState>}
      {!isPending && !isError && latest.length === 0 && (
        <EmptyState>Log a reading to start tracking your vitals.</EmptyState>
      )}
      {latest.length > 0 && (
        <ul className="flex flex-col gap-2">
          {latest.map((vital) => (
            <li key={vital.id} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-content-muted">
                {VITAL_TYPE_LABELS[vital.type]}
              </span>
              <span className="text-sm font-medium">
                {formatVitalValue(vital)} {VITAL_UNITS[vital.type]}
              </span>
              <VitalStatusBadge vital={vital} />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
