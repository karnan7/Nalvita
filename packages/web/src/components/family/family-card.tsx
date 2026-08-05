import { calculateAge } from '@nalvita/core';
import { ChevronRight } from 'lucide-react';

import { StatusBadge } from '@/components/ui-nalvita';
import { VitalStatusBadge } from '@/components/vitals/vital-status-badge';
import { CIRCLE_ROLE_LABELS } from '@/lib/circle';
import { activeMedicineCount, type FamilySummary } from '@/lib/family-overview';
import { formatDocDate } from '@/lib/documents';
import { formatVitalValue, VITAL_TYPE_LABELS } from '@/lib/vitals';

/** Their name, plus their age when the profile category is shared. */
function personLabel(summary: FamilySummary): string {
  const name = summary.person.counterpart_name?.trim() || 'Family member';
  if (!summary.dateOfBirth) return name;
  return `${name}, ${calculateAge(summary.dateOfBirth)}`;
}

/** "3 medicines", or nothing at all when medicines aren't shared with me. */
function medicineLine(summary: FamilySummary): string | null {
  const count = activeMedicineCount(summary.medicines);
  if (count === null) return null;
  if (count === 0) return 'No medicines';
  return count === 1 ? '1 medicine' : `${count} medicines`;
}

/**
 * One person in my circle, summarised: what they're on, their latest reading,
 * when they last saw a doctor, and anything needing me today.
 */
export function FamilyCard({
  summary,
  onOpen,
}: Readonly<{ summary: FamilySummary; onOpen: (summary: FamilySummary) => void }>) {
  const { person, latestVital, lastCheckup, attentions } = summary;
  const medicines = medicineLine(summary);

  return (
    <button
      type="button"
      onClick={() => onOpen(summary)}
      className="flex w-full items-center gap-4 rounded-2xl border border-border-default bg-surface p-4 text-left shadow-sm transition-colors hover:border-border-strong"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="font-heading text-lg font-bold tracking-tight text-content">
            {personLabel(summary)}
          </p>
          <span className="text-xs text-content-muted">{CIRCLE_ROLE_LABELS[person.role]}</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-content-secondary">
          {medicines && <span>{medicines}</span>}
          {latestVital && (
            <span className="flex items-center gap-2">
              <span>{VITAL_TYPE_LABELS[latestVital.type]}</span>
              <span className="font-medium text-content">{formatVitalValue(latestVital)}</span>
              <VitalStatusBadge vital={latestVital} />
            </span>
          )}
          {lastCheckup && <span>Last seen a doctor {formatDocDate(lastCheckup)}</span>}
        </div>

        {attentions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attentions.map((attention) => (
              <StatusBadge key={attention.kind} variant="high">
                {attention.label}
              </StatusBadge>
            ))}
          </div>
        )}
      </div>

      <ChevronRight className="size-5 shrink-0 text-content-muted" />
    </button>
  );
}
