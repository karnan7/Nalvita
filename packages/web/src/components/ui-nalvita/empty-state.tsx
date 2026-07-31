import type { ComponentType, ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface EmptyStateProps {
  /** Optional icon shown above the message for standalone empty states. */
  icon?: ComponentType<{ className?: string }>;
  /** Headline; when omitted the component renders `children` as muted text. */
  title?: string;
  /** Supporting line under the title. */
  description?: string;
  /** A call to action (e.g. an "Add" button). */
  action?: ReactNode;
  /** Simple inline form: muted text with no icon/title (used inside cards). */
  children?: ReactNode;
  className?: string;
}

/**
 * A friendly prompt shown when there's no data yet. Pass `title` (plus an
 * optional `icon`/`description`/`action`) for a standalone centred empty
 * state, or just `children` for a compact muted line inside a card.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  children,
  className,
}: Readonly<EmptyStateProps>) {
  if (!title) {
    return <p className={cn('text-sm text-content-muted', className)}>{children}</p>;
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg px-6 py-10 text-center',
        className,
      )}
    >
      {Icon && (
        <span className="flex size-12 items-center justify-center rounded-full bg-sunken text-content-muted">
          <Icon className="size-6" />
        </span>
      )}
      <div className="flex flex-col gap-1">
        <p className="font-medium text-content">{title}</p>
        {description && <p className="text-sm text-content-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
