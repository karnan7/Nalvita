import { Activity, FileText, Pill, Stethoscope, type LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { buildTimelineEvents, filterTimelineEvents, useConditions, useDocuments, useMedicines, useVitals, type TimelineKind, type TimelineKindFilter, type TimelineRange } from '@nalvita/data';
import { cn } from '@/lib/utils';

const KIND_ICONS: Record<TimelineKind, LucideIcon> = {
  document: FileText,
  vital: Activity,
  medicine: Pill,
  condition: Stethoscope,
};

const KIND_FILTERS: { value: TimelineKindFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'document', label: 'Documents' },
  { value: 'medicine', label: 'Medicines' },
  { value: 'vital', label: 'Vitals' },
  { value: 'condition', label: 'Conditions' },
];

const RANGE_FILTERS: { value: TimelineRange; label: string }[] = [
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 365, label: 'Last year' },
  { value: null, label: 'All time' },
];

/** How many entries to reveal per "Load more" — keeps long histories snappy. */
const PAGE_SIZE = 30;

/** Formats an ISO date or datetime as a short calendar date. */
function formatEventDate(at: string): string {
  const date = at.length === 10 ? new Date(`${at}T00:00:00`) : new Date(at);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function FilterChips<T extends string | number | null>({
  options,
  selected,
  onSelect,
}: Readonly<{
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}>) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => onSelect(option.value)}
          className={cn(
            'rounded-full border px-3 py-1 text-sm transition-colors',
            selected === option.value
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input hover:bg-accent',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function TimelinePage() {
  const documents = useDocuments();
  const vitals = useVitals();
  const medicines = useMedicines();
  const conditions = useConditions();

  const [kind, setKind] = useState<TimelineKindFilter>('all');
  const [range, setRange] = useState<TimelineRange>(90);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const isPending =
    documents.isPending || vitals.isPending || medicines.isPending || conditions.isPending;
  const isError =
    documents.isError || vitals.isError || medicines.isError || conditions.isError;

  const events = useMemo(
    () =>
      buildTimelineEvents(
        documents.data ?? [],
        vitals.data ?? [],
        medicines.data ?? [],
        conditions.data ?? [],
      ),
    [documents.data, vitals.data, medicines.data, conditions.data],
  );

  const filtered = useMemo(
    () => filterTimelineEvents(events, { kind, range }),
    [events, kind, range],
  );

  // Reset paging whenever the filters change so "Load more" starts fresh.
  const shown = filtered.slice(0, visible);

  function changeKind(value: TimelineKindFilter) {
    setKind(value);
    setVisible(PAGE_SIZE);
  }

  function changeRange(value: TimelineRange) {
    setRange(value);
    setVisible(PAGE_SIZE);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Timeline</h1>
        <p className="text-sm text-muted-foreground">
          Your complete health history, newest first.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <FilterChips options={KIND_FILTERS} selected={kind} onSelect={changeKind} />
        <FilterChips options={RANGE_FILTERS} selected={range} onSelect={changeRange} />
      </div>

      {isPending && <p className="text-sm text-muted-foreground">Loading your history…</p>}
      {isError && (
        <p className="text-sm text-destructive">
          We couldn't load your timeline. Please refresh the page.
        </p>
      )}

      {!isPending && !isError && filtered.length === 0 && (
        <p className="text-muted-foreground">
          {events.length === 0
            ? 'Your health events will appear here as you add records.'
            : 'No events match these filters.'}
        </p>
      )}

      {shown.length > 0 && (
        <ul className="flex flex-col gap-3">
          {shown.map((event) => {
            const Icon = KIND_ICONS[event.kind];
            return (
              <li key={event.id}>
                <Link
                  to={event.to ?? '#'}
                  className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
                >
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
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {filtered.length > shown.length && (
        <button
          type="button"
          onClick={() => setVisible((count) => count + PAGE_SIZE)}
          className="mx-auto rounded-full border border-input px-4 py-2 text-sm transition-colors hover:bg-accent"
        >
          Load more
        </button>
      )}
    </div>
  );
}
