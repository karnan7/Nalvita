import { cn } from '@/lib/utils';

/** Muted placeholder line used while a card's data is still loading. */
export function SkeletonLine({ className }: Readonly<{ className?: string }>) {
  return <div className={cn('animate-pulse rounded bg-sunken', className ?? 'h-4 w-full')} />;
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
