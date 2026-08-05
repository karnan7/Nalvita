import { VITAL_TYPES, type Vital, type VitalType } from '@nalvita/core';
import { Download, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { VitalChart } from '@/components/vitals/vital-chart';
import { VitalHistoryTable } from '@/components/vitals/vital-history-table';
import { VitalLogDialog } from '@/components/vitals/vital-log-dialog';
import { Button } from '@/components/ui/button';
import { useRecordPermissions } from '@/lib/circle';
import { cn } from '@/lib/utils';
import { exportVitalsPdf } from '@/lib/vitals-pdf';
import { useVitals, VITAL_TYPE_LABELS } from '@/lib/vitals';

const RANGES = [30, 90] as const;

function TypeChips({
  selected,
  onSelect,
}: Readonly<{ selected: VitalType; onSelect: (type: VitalType) => void }>) {
  return (
    <div className="flex flex-wrap gap-2">
      {VITAL_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onSelect(type)}
          className={cn(
            'rounded-full border px-3 py-1 text-sm transition-colors',
            selected === type
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input hover:bg-accent',
          )}
        >
          {VITAL_TYPE_LABELS[type]}
        </button>
      ))}
    </div>
  );
}

function RangeToggle({
  days,
  onSelect,
}: Readonly<{ days: number; onSelect: (days: number) => void }>) {
  return (
    <div className="flex gap-2">
      {RANGES.map((range) => (
        <button
          key={range}
          type="button"
          onClick={() => onSelect(range)}
          className={cn(
            'rounded-md border px-3 py-1 text-sm transition-colors',
            days === range
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input hover:bg-accent',
          )}
        >
          {range} days
        </button>
      ))}
    </div>
  );
}

export default function VitalsPage() {
  const { data: vitals, isPending, isError } = useVitals();
  const { canWrite, canDelete, guardWrite } = useRecordPermissions();
  const [type, setType] = useState<VitalType>('blood_pressure');
  const [days, setDays] = useState<number>(30);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vital | null>(null);

  const readings = useMemo(
    () => (vitals ?? []).filter((v) => v.type === type),
    [vitals, type],
  );

  function openLog() {
    guardWrite(() => {
      setEditing(null);
      setDialogOpen(true);
    });
  }

  function openEdit(vital: Vital) {
    guardWrite(() => {
      setEditing(vital);
      setDialogOpen(true);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Vitals</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => vitals && exportVitalsPdf(vitals)}
            disabled={!vitals || vitals.length === 0}
          >
            <Download />
            Export PDF
          </Button>
          {canWrite && (
            <Button onClick={openLog}>
              <Plus />
              Log vitals
            </Button>
          )}
        </div>
      </div>

      <TypeChips selected={type} onSelect={setType} />

      {isPending && <p className="text-sm text-muted-foreground">Loading your readings…</p>}
      {isError && (
        <p className="text-sm text-destructive">
          We couldn't load your vitals. Please refresh the page.
        </p>
      )}

      {!isPending && !isError && (
        <>
          <div className="flex flex-col gap-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">{VITAL_TYPE_LABELS[type]} trend</h2>
              <RangeToggle days={days} onSelect={setDays} />
            </div>
            <VitalChart vitals={vitals ?? []} type={type} days={days} />
          </div>

          {readings.length === 0 ? (
            <p className="text-muted-foreground">
              No {VITAL_TYPE_LABELS[type].toLowerCase()} readings yet. Log your first one above.
            </p>
          ) : (
            <VitalHistoryTable
              readings={readings}
              onEdit={canWrite ? openEdit : null}
              canDelete={canDelete}
            />
          )}
        </>
      )}

      <VitalLogDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        vital={editing}
        defaultType={type}
      />
    </div>
  );
}
