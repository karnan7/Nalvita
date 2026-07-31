import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Health status pill using the Nalvita status pairs. `normal` = green,
 * `high` = amber/borderline, `low` = blue, `critical` = red alert.
 */
export type StatusVariant = 'normal' | 'high' | 'low' | 'critical';

const VARIANT_CLASS: Record<StatusVariant, string> = {
  normal: 'bg-status-normal-bg text-status-normal-fg',
  high: 'bg-status-high-bg text-status-high-fg',
  low: 'bg-status-low-bg text-status-low-fg',
  critical: 'bg-status-critical-bg text-status-critical-fg',
};

interface StatusBadgeProps {
  variant: StatusVariant;
  children: ReactNode;
  className?: string;
}

export function StatusBadge({ variant, children, className }: Readonly<StatusBadgeProps>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        VARIANT_CLASS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
