import type { Allergy } from '@nalvita/core';
import { useState } from 'react';

import { AllergyCard } from '@/components/profile/allergy-card';
import { AllergyDialog } from '@/components/profile/allergy-dialog';
import { ProfileSection } from '@/components/profile/profile-section';
import { sortBySeverity, useAllergies } from '@nalvita/data';

export function AllergySection() {
  const { data: allergies, isPending, isError } = useAllergies();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Allergy | null>(null);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(allergy: Allergy) {
    setEditing(allergy);
    setDialogOpen(true);
  }

  const sorted = sortBySeverity(allergies ?? []);

  return (
    <ProfileSection title="Allergies" addLabel="Add allergy" onAdd={openAdd}>
      {isPending && <p className="text-sm text-muted-foreground">Loading your allergies…</p>}
      {isError && (
        <p className="text-sm text-destructive">
          We couldn't load your allergies. Please refresh the page.
        </p>
      )}
      {!isPending && !isError && sorted.length === 0 && (
        <p className="text-muted-foreground">
          No allergies recorded. Add any so they're never missed.
        </p>
      )}
      {sorted.length > 0 && (
        <ul className="flex flex-col gap-3">
          {sorted.map((allergy) => (
            <AllergyCard key={allergy.id} allergy={allergy} onEdit={openEdit} />
          ))}
        </ul>
      )}

      <AllergyDialog open={dialogOpen} onClose={() => setDialogOpen(false)} allergy={editing} />
    </ProfileSection>
  );
}
