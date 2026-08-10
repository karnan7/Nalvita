import { History } from 'lucide-react';

import { EmptyState, SectionCard } from '@/components/ui-nalvita';
import { Button } from '@/components/ui/button';
import { describeAuditEntry, formatActivityTime, groupByDay, useActivityFeed, type ActivityDay } from '@nalvita/data';

function DayGroup({ group }: Readonly<{ group: ActivityDay }>) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-content-secondary">{group.day}</h3>
      <ul className="flex flex-col gap-2">
        {group.entries.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-xl border border-border-subtle bg-app px-4 py-3"
          >
            <span className="text-sm text-content">{describeAuditEntry(entry)}</span>
            <span className="text-xs text-content-muted">
              {formatActivityTime(entry.created_at)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Everything other people have done in my account, newest first. My own actions
 * are left out — this answers "what did someone else do here?", and the feed
 * stays empty (with a reassuring line) until someone actually has access.
 */
export function ActivityFeed() {
  const { data, isPending, isError, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useActivityFeed();

  const entries = data?.pages.flat() ?? [];
  const days = groupByDay(entries);

  return (
    <SectionCard title="Activity in your account">
      {isPending && <p className="text-sm text-content-muted">Loading activity…</p>}

      {isError && (
        <p className="text-sm text-destructive">
          We couldn&apos;t load your activity. Please refresh the page.
        </p>
      )}

      {!isPending && !isError && entries.length === 0 && (
        <EmptyState
          icon={History}
          title="Nothing to show"
          description="When someone in your circle views or changes your records, it will appear here."
        />
      )}

      {days.length > 0 && (
        <div className="flex flex-col gap-5">
          {days.map((group) => (
            <DayGroup key={group.day} group={group} />
          ))}
          {hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                disabled={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
              >
                {isFetchingNextPage ? 'Loading…' : 'Show older activity'}
              </Button>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}
