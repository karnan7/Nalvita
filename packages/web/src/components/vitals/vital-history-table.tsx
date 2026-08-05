import type { Vital } from '@nalvita/core';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { VitalStatusBadge } from '@/components/vitals/vital-status-badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { formatMeasuredAt, formatVitalValue, useDeleteVital, VITAL_UNITS } from '@/lib/vitals';

interface VitalHistoryTableProps {
  readings: Vital[];
  /** Null when the current role may not change this person's readings. */
  onEdit: ((vital: Vital) => void) | null;
  /** False when the current role may not remove them. */
  canDelete?: boolean;
}

export function VitalHistoryTable({
  readings,
  onEdit,
  canDelete = true,
}: Readonly<VitalHistoryTableProps>) {
  const [deleting, setDeleting] = useState<Vital | null>(null);
  const remove = useDeleteVital();

  function confirmDelete() {
    if (!deleting) return;
    remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="py-2 pr-4 font-medium">When</th>
            <th className="py-2 pr-4 font-medium">Reading</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-4 font-medium">Notes</th>
            <th className="py-2 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {readings.map((reading) => (
            <tr key={reading.id} className="border-b last:border-0">
              <td className="py-2 pr-4 whitespace-nowrap">{formatMeasuredAt(reading.measured_at)}</td>
              <td className="py-2 pr-4 whitespace-nowrap">
                {formatVitalValue(reading)}{' '}
                <span className="text-muted-foreground">{VITAL_UNITS[reading.type]}</span>
              </td>
              <td className="py-2 pr-4">
                <VitalStatusBadge vital={reading} />
              </td>
              <td className="py-2 pr-4 text-muted-foreground">{reading.notes}</td>
              <td className="py-2">
                <div className="flex justify-end gap-1">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Edit reading"
                      onClick={() => onEdit(reading)}
                    >
                      <Pencil />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete reading"
                      onClick={() => setDeleting(reading)}
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title="Delete this reading?">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            This reading will be permanently removed. This cannot be undone.
          </p>
          {remove.isError && (
            <p className="text-sm text-destructive">We couldn't delete it. Please try again.</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={remove.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={remove.isPending}
            >
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
