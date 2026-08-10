import { Activity, FileText, Pill, Stethoscope, type LucideIcon } from 'lucide-react';

import { CardSkeleton, EmptyState, SectionCard } from '@/components/ui-nalvita';
import { buildTimeline, useDocuments, useMedicines, useVitals, type TimelineKind } from '@nalvita/data';

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
    <SectionCard title="Recent activity">
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
                <Icon className="mt-0.5 size-4 shrink-0 text-content-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{event.title}</p>
                  {event.detail && (
                    <p className="truncate text-xs text-content-muted">{event.detail}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-content-muted">
                  {formatEventDate(event.at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
