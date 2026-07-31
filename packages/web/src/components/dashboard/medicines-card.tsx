import { CardSkeleton, EmptyState, SectionCard, StatusBadge } from '@/components/ui-nalvita';
import { activeMedicines } from '@/lib/dashboard';
import { isRefillDue, MEDICINE_FREQUENCY_LABELS, useMedicines } from '@/lib/medicines';

export function MedicinesCard() {
  const { data: medicines, isPending, isError } = useMedicines();
  const active = activeMedicines(medicines ?? []).slice(0, 4);

  return (
    <SectionCard title="Medicines" seeAllTo="/medicines">
      {isPending && <CardSkeleton />}
      {isError && <EmptyState>We couldn't load your medicines.</EmptyState>}
      {!isPending && !isError && active.length === 0 && (
        <EmptyState>Add a medicine to start tracking what you take.</EmptyState>
      )}
      {active.length > 0 && (
        <ul className="flex flex-col gap-2">
          {active.map((medicine) => (
            <li key={medicine.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="font-medium">{medicine.name}</span>{' '}
                <span className="text-content-muted">
                  · {MEDICINE_FREQUENCY_LABELS[medicine.frequency]}
                </span>
              </span>
              {isRefillDue(medicine) && (
                <StatusBadge variant="high" className="shrink-0">
                  Refill due
                </StatusBadge>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
