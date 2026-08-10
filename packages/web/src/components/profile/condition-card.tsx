import type { Condition, ConditionStatus } from '@nalvita/core';
import { useState } from 'react';

import { StatusBadge, type StatusVariant } from '@/components/ui-nalvita';
import { RecordActions } from '@/components/profile/record-actions';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { CONDITION_STATUS_LABELS, formatConditionDate, useDeleteCondition } from '@nalvita/data';

interface ConditionCardProps {
  condition: Condition;
  onEdit: (condition: Condition) => void;
}

/** Active = still ongoing (amber), managed = under control (green); resolved = past (neutral). */
const STATUS_VARIANT: Record<Exclude<ConditionStatus, 'resolved'>, StatusVariant> = {
  active: 'high',
  managed: 'normal',
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
          {condition.status === 'resolved' ? (
            <span className="inline-flex items-center rounded-full bg-sunken px-2 py-0.5 text-xs font-medium text-content-muted">
              {CONDITION_STATUS_LABELS.resolved}
            </span>
          ) : (
            <StatusBadge variant={STATUS_VARIANT[condition.status]}>
              {CONDITION_STATUS_LABELS[condition.status]}
            </StatusBadge>
          )}
        </div>
        {meta.length > 0 && <p className="text-sm text-muted-foreground">{meta.join(' · ')}</p>}
        {condition.notes && (
          <p className="mt-1 text-sm text-muted-foreground">{condition.notes}</p>
        )}
      </div>
      <RecordActions
        onEdit={() => onEdit(condition)}
        onDelete={() => setConfirmingDelete(true)}
        deleteLabel={`Delete ${condition.name}`}
      />

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
