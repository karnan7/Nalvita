import { Activity, FileText, HeartPulse, Pill } from 'lucide-react';

import { StatCard } from '@/components/ui-nalvita';
import { useConditions } from '@/lib/conditions';
import { activeMedicines, lastCheckupDate, refillDueCount } from '@/lib/dashboard';
import { formatDocDate, useDocuments } from '@/lib/documents';
import { useMedicines } from '@/lib/medicines';

export function StatCards() {
  const documents = useDocuments();
  const medicines = useMedicines();
  const conditions = useConditions();

  const active = activeMedicines(medicines.data ?? []);
  const refills = refillDueCount(medicines.data ?? []);
  const checkup = lastCheckupDate(documents.data ?? []);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard
        icon={FileText}
        label="Documents"
        value={String(documents.data?.length ?? 0)}
        to="/documents"
        isLoading={documents.isPending}
      />
      <StatCard
        icon={Pill}
        label="Active medicines"
        value={String(active.length)}
        hint={refills > 0 ? `${refills} refill${refills > 1 ? 's' : ''} due` : undefined}
        to="/medicines"
        isLoading={medicines.isPending}
      />
      <StatCard
        icon={HeartPulse}
        label="Conditions"
        value={String(conditions.data?.length ?? 0)}
        to="/profile"
        isLoading={conditions.isPending}
      />
      <StatCard
        icon={Activity}
        label="Last checkup"
        value={checkup ? formatDocDate(checkup) : '—'}
        to="/documents"
        isLoading={documents.isPending}
      />
    </div>
  );
}
