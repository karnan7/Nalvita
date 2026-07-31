import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';

import { SkeletonLine } from '@/components/ui-nalvita/skeleton';

interface StatCardProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  to: string;
  isLoading?: boolean;
}

/** A dashboard metric card: a soft icon chip, the big value, then the label. */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  to,
  isLoading = false,
}: Readonly<StatCardProps>) {
  return (
    <Link
      to={to}
      className="flex flex-col gap-3 rounded-2xl border border-border-default bg-surface p-4 shadow-sm transition-colors hover:border-border-strong"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-status-normal-bg text-status-normal-fg">
        <Icon className="size-5" />
      </span>
      {isLoading ? (
        <SkeletonLine className="h-8 w-14" />
      ) : (
        <p className="font-heading text-2xl font-extrabold tracking-tight text-content">{value}</p>
      )}
      <div>
        <p className="text-sm font-medium text-content-muted">{label}</p>
        {!isLoading && hint && <p className="text-xs text-content-muted">{hint}</p>}
      </div>
    </Link>
  );
}
