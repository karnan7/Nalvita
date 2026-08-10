import type { Medicine } from '@nalvita/core';
import { Pencil, Square } from 'lucide-react';
import { useState } from 'react';

import { StatusBadge } from '@/components/ui-nalvita';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { MEDICINE_FREQUENCY_LABELS, MEDICINE_TIMING_LABELS, formatMedDate, isMedicinePast, isRefillDue, todayIso, useStopMedicine } from '@nalvita/data';

interface MedicineCardProps {
  medicine: Medicine;
  /** Null when the current role may not change this person's medicines. */
  onEdit: ((medicine: Medicine) => void) | null;
}

export function MedicineCard({ medicine, onEdit }: Readonly<MedicineCardProps>) {
  const [stopping, setStopping] = useState(false);
  const [endDate, setEndDate] = useState(todayIso());
  const stop = useStopMedicine();

  const past = isMedicinePast(medicine);
  const refillDue = isRefillDue(medicine);

  function confirmStop() {
    stop.mutate({ id: medicine.id, endDate }, { onSuccess: () => setStopping(false) });
  }

  const schedule = [
    MEDICINE_FREQUENCY_LABELS[medicine.frequency],
    medicine.timings.map((timing) => MEDICINE_TIMING_LABELS[timing]).join(', ') || null,
  ].filter(Boolean);

  const meta = [
    medicine.doctor_name,
    `Started ${formatMedDate(medicine.start_date)}`,
    medicine.end_date ? `Ended ${formatMedDate(medicine.end_date)}` : null,
    medicine.refill_date && !past ? `Refill ${formatMedDate(medicine.refill_date)}` : null,
  ].filter(Boolean);

  return (
    <li className="flex flex-col gap-3 rounded-lg border p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">
            {medicine.name} <span className="text-muted-foreground">· {medicine.dosage}</span>
          </p>
          {refillDue && <StatusBadge variant="high">Refill due</StatusBadge>}
        </div>
        <p className="text-sm text-muted-foreground">{schedule.join(' · ')}</p>
        <p className="text-sm text-muted-foreground">{meta.join(' · ')}</p>
        {medicine.notes && (
          <p className="mt-1 text-sm text-muted-foreground">{medicine.notes}</p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        {onEdit && (
          <Button variant="outline" size="sm" onClick={() => onEdit(medicine)}>
            <Pencil />
            Edit
          </Button>
        )}
        {onEdit && !past && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEndDate(todayIso());
              setStopping(true);
            }}
          >
            <Square />
            Stop
          </Button>
        )}
      </div>

      <Modal open={stopping} onClose={() => setStopping(false)} title="Stop this medicine?">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{medicine.name}</span> will move to your
            Past medicines. It stays in your history.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="stop-end-date">End date</Label>
            <Input
              id="stop-end-date"
              type="date"
              min={medicine.start_date}
              max={todayIso()}
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
          {stop.isError && (
            <p className="text-sm text-destructive">We couldn't update it. Please try again.</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStopping(false)}
              disabled={stop.isPending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmStop} disabled={!endDate || stop.isPending}>
              {stop.isPending ? 'Saving…' : 'Mark stopped'}
            </Button>
          </div>
        </div>
      </Modal>
    </li>
  );
}
