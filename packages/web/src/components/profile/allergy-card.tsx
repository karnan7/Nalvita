import type { Allergy } from '@nalvita/core';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { AllergySeverityBadge } from '@/components/profile/allergy-severity-badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useDeleteAllergy } from '@/lib/allergies';

interface AllergyCardProps {
  allergy: Allergy;
  onEdit: (allergy: Allergy) => void;
}

export function AllergyCard({ allergy, onEdit }: Readonly<AllergyCardProps>) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteAllergy = useDeleteAllergy();

  function confirmDelete() {
    deleteAllergy.mutate(allergy.id, { onSuccess: () => setConfirmingDelete(false) });
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{allergy.allergen}</p>
          <AllergySeverityBadge severity={allergy.severity} />
        </div>
        {allergy.reaction && (
          <p className="mt-1 text-sm text-muted-foreground">{allergy.reaction}</p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" onClick={() => onEdit(allergy)}>
          <Pencil />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Delete ${allergy.allergen}`}
          onClick={() => setConfirmingDelete(true)}
        >
          <Trash2 className="text-destructive" />
        </Button>
      </div>

      <Modal
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete allergy?"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{allergy.allergen}</span> will be
            permanently removed from your profile.
          </p>
          {deleteAllergy.isError && (
            <p className="text-sm text-destructive">We couldn't delete it. Please try again.</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleteAllergy.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteAllergy.isPending}
            >
              {deleteAllergy.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </li>
  );
}
