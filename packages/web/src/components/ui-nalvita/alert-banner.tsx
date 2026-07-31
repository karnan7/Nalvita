import { AlertTriangle } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';

interface AlertBannerProps {
  title: string;
  children: ReactNode;
  /** Icon shown at the start; defaults to a warning triangle. */
  icon?: ComponentType<{ className?: string }>;
  /** When set, the whole banner becomes a link to this destination. */
  to?: string;
  className?: string;
}

/**
 * Critical-status banner using the red `critical` pair — the allergy alert on
 * the dashboard. Impossible-to-miss, life-saving context.
 */
export function AlertBanner({
  title,
  children,
  icon: Icon = AlertTriangle,
  to,
  className,
}: Readonly<AlertBannerProps>) {
  const classes = cn(
    'flex items-start gap-3 rounded-xl border border-status-critical-fg/25 bg-status-critical-bg p-4 text-status-critical-fg',
    to && 'transition-opacity hover:opacity-90',
    className,
  );

  const content = (
    <>
      <Icon className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <div className="text-sm">{children}</div>
      </div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }

  return <div className={classes}>{content}</div>;
}
