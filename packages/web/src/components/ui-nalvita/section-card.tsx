import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';

interface SectionCardProps {
  title: string;
  /** Optional "See all" destination shown in the card header. */
  seeAllTo?: string;
  /** Optional custom label for the header affordance (defaults to "See all"). */
  seeAllLabel?: string;
  children: ReactNode;
  className?: string;
}

/** A surface card with a titled header and an optional "See all" affordance. */
export function SectionCard({
  title,
  seeAllTo,
  seeAllLabel = 'See all',
  children,
  className,
}: Readonly<SectionCardProps>) {
  return (
    <section
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-border-default bg-surface p-5 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-content">{title}</h2>
        {seeAllTo && (
          <Link
            to={seeAllTo}
            className="inline-flex items-center gap-1 text-sm font-medium text-interactive transition-colors hover:text-interactive-hover"
          >
            {seeAllLabel}
            <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
