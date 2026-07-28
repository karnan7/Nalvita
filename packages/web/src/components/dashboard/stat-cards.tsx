import { Activity, FileText, HeartPulse, Pill } from 'lucide-react';
import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';

import { SkeletonLine } from '@/components/dashboard/dashboard-card';
import { useConditions } from '@/lib/conditions';
import { activeMedicines, lastCheckupDate, refillDueCount } from '@/lib/dashboard';
import { formatDocDate, useDocuments } from '@/lib/documents';
import { useMedicines } from '@/lib/medicines';

interface StatTileProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  to: string;
  isLoading: boolean;
}

function StatTile({ icon: Icon, label, value, hint, to, isLoading }: Readonly<StatTileProps>) {
  return (
    <Link
      to={to}
      className="flex flex-col gap-1 rounded-lg border p-4 shadow-sm transition-colors hover:bg-muted/50"
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      {isLoading ? (
        <SkeletonLine className="mt-1 h-7 w-12" />
      ) : (
        <p className="text-2xl font-bold">{value}</p>
      )}
      {!isLoading && hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Link>
  );
}

export function StatCards() {
  const documents = useDocuments();
  const medicines = useMedicines();
  const conditions = useConditions();

  const active = activeMedicines(medicines.data ?? []);
  const refills = refillDueCount(medicines.data ?? []);
  const checkup = lastCheckupDate(documents.data ?? []);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile
        icon={FileText}
        label="Documents"
        value={String(documents.data?.length ?? 0)}
        to="/documents"
        isLoading={documents.isPending}
      />
      <StatTile
        icon={Pill}
        label="Active medicines"
        value={String(active.length)}
        hint={refills > 0 ? `${refills} refill${refills > 1 ? 's' : ''} due` : undefined}
        to="/medicines"
        isLoading={medicines.isPending}
      />
      <StatTile
        icon={HeartPulse}
        label="Conditions"
        value={String(conditions.data?.length ?? 0)}
        to="/profile"
        isLoading={conditions.isPending}
      />
      <StatTile
        icon={Activity}
        label="Last checkup"
        value={checkup ? formatDocDate(checkup) : '—'}
        to="/documents"
        isLoading={documents.isPending}
      />
    </div>
  );
}
