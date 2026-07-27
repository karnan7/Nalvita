import type { Condition } from '@nalvita/core';
import { useState } from 'react';

import { ConditionCard } from '@/components/profile/condition-card';
import { ConditionDialog } from '@/components/profile/condition-dialog';
import { ProfileSection } from '@/components/profile/profile-section';
import { useConditions } from '@/lib/conditions';

export function ConditionSection() {
  const { data: conditions, isPending, isError } = useConditions();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Condition | null>(null);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(condition: Condition) {
    setEditing(condition);
    setDialogOpen(true);
  }

  return (
    <ProfileSection title="Conditions" addLabel="Add condition" onAdd={openAdd}>
      {isPending && <p className="text-sm text-muted-foreground">Loading your conditions…</p>}
      {isError && (
        <p className="text-sm text-destructive">
          We couldn't load your conditions. Please refresh the page.
        </p>
      )}
      {!isPending && !isError && (conditions ?? []).length === 0 && (
        <p className="text-muted-foreground">
          No conditions recorded. Add any diagnoses you're managing.
        </p>
      )}
      {(conditions ?? []).length > 0 && (
        <ul className="flex flex-col gap-3">
          {conditions?.map((condition) => (
            <ConditionCard key={condition.id} condition={condition} onEdit={openEdit} />
          ))}
        </ul>
      )}

      <ConditionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        condition={editing}
      />
    </ProfileSection>
  );
}
