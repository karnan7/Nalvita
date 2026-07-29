import { Activity, FileText, Pill, Stethoscope, type LucideIcon } from 'lucide-react';

import {
  CardSkeleton,
  DashboardCard,
  EmptyState,
} from '@/components/dashboard/dashboard-card';
import { useDocuments } from '@/lib/documents';
import { useMedicines } from '@/lib/medicines';
import { buildTimeline, type TimelineKind } from '@/lib/timeline';
import { useVitals } from '@/lib/vitals';

const KIND_ICONS: Record<TimelineKind, LucideIcon> = {
  document: FileText,
  vital: Activity,
  medicine: Pill,
  condition: Stethoscope,
};

/** Formats an ISO date or datetime as a short calendar date. */
function formatEventDate(at: string): string {
  const date = at.length === 10 ? new Date(`${at}T00:00:00`) : new Date(at);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function TimelineCard() {
  const documents = useDocuments();
  const vitals = useVitals();
  const medicines = useMedicines();

  const isPending = documents.isPending || vitals.isPending || medicines.isPending;
  const isError = documents.isError || vitals.isError || medicines.isError;
  const events = buildTimeline(documents.data ?? [], vitals.data ?? [], medicines.data ?? []);

  return (
    <DashboardCard title="Recent activity">
      {isPending && <CardSkeleton />}
      {isError && <EmptyState>We couldn't load your recent activity.</EmptyState>}
      {!isPending && !isError && events.length === 0 && (
        <EmptyState>Your health events will appear here as you add records.</EmptyState>
      )}
      {events.length > 0 && (
        <ul className="flex flex-col gap-3">
          {events.map((event) => {
            const Icon = KIND_ICONS[event.kind];
            return (
              <li key={event.id} className="flex items-start gap-3">
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{event.title}</p>
                  {event.detail && (
                    <p className="truncate text-xs text-muted-foreground">{event.detail}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatEventDate(event.at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}
