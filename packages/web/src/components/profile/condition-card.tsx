import type { Condition, ConditionStatus } from '@nalvita/core';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import {
  CONDITION_STATUS_LABELS,
  formatConditionDate,
  useDeleteCondition,
} from '@/lib/conditions';

interface ConditionCardProps {
  condition: Condition;
  onEdit: (condition: Condition) => void;
}

/** Active = still ongoing (amber), managed = under control (green), resolved = past (neutral). */
const STATUS_BADGE_CLASS: Record<ConditionStatus, string> = {
  active: 'bg-amber-100 text-amber-800',
  managed: 'bg-green-100 text-green-800',
  resolved: 'bg-muted text-muted-foreground',
};

export function ConditionCard({ condition, onEdit }: Readonly<ConditionCardProps>) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteCondition = useDeleteCondition();

  function confirmDelete() {
    deleteCondition.mutate(condition.id, { onSuccess: () => setConfirmingDelete(false) });
  }

  const meta = [
    condition.diagnosis_date
      ? `Diagnosed ${formatConditionDate(condition.diagnosis_date)}`
      : null,
    condition.doctor_name,
  ].filter(Boolean);

  return (
    <li className="flex flex-col gap-3 rounded-lg border p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{condition.name}</p>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              STATUS_BADGE_CLASS[condition.status],
            )}
          >
            {CONDITION_STATUS_LABELS[condition.status]}
          </span>
        </div>
        {meta.length > 0 && <p className="text-sm text-muted-foreground">{meta.join(' · ')}</p>}
        {condition.notes && (
          <p className="mt-1 text-sm text-muted-foreground">{condition.notes}</p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" onClick={() => onEdit(condition)}>
          <Pencil />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Delete ${condition.name}`}
          onClick={() => setConfirmingDelete(true)}
        >
          <Trash2 className="text-destructive" />
        </Button>
      </div>

      <Modal
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete condition?"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{condition.name}</span> will be
            permanently removed from your profile.
          </p>
          {deleteCondition.isError && (
            <p className="text-sm text-destructive">We couldn't delete it. Please try again.</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleteCondition.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteCondition.isPending}
            >
              {deleteCondition.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </li>
  );
}
