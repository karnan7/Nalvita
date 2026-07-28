import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface DashboardCardProps {
  title: string;
  /** Optional "See all" destination shown in the card header. */
  seeAllTo?: string;
  children: ReactNode;
}

export function DashboardCard({ title, seeAllTo, children }: Readonly<DashboardCardProps>) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {seeAllTo && (
          <Link
            to={seeAllTo}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            See all
            <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** Muted placeholder line used while a card's data is still loading. */
export function SkeletonLine({ className = 'h-4 w-full' }: Readonly<{ className?: string }>) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

/** A few skeleton lines standing in for a card's body while it loads. */
export function CardSkeleton({ rows = 3 }: Readonly<{ rows?: number }>) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonLine key={i} className="h-4 w-3/4" />
      ))}
    </div>
  );
}

/** A friendly prompt shown when a card has no data yet. */
export function EmptyState({ children }: Readonly<{ children: ReactNode }>) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
