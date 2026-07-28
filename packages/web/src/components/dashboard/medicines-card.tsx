import {
  CardSkeleton,
  DashboardCard,
  EmptyState,
} from '@/components/dashboard/dashboard-card';
import { activeMedicines } from '@/lib/dashboard';
import { isRefillDue, MEDICINE_FREQUENCY_LABELS, useMedicines } from '@/lib/medicines';

export function MedicinesCard() {
  const { data: medicines, isPending, isError } = useMedicines();
  const active = activeMedicines(medicines ?? []).slice(0, 4);

  return (
    <DashboardCard title="Medicines" seeAllTo="/medicines">
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
                <span className="text-muted-foreground">
                  · {MEDICINE_FREQUENCY_LABELS[medicine.frequency]}
                </span>
              </span>
              {isRefillDue(medicine) && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  Refill due
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
