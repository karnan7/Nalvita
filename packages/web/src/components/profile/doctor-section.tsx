import type { Doctor } from '@nalvita/core';
import { useState } from 'react';

import { DoctorCard } from '@/components/profile/doctor-card';
import { DoctorDialog } from '@/components/profile/doctor-dialog';
import { ProfileSection } from '@/components/profile/profile-section';
import { useDoctors } from '@nalvita/data';

export function DoctorSection() {
  const { data: doctors, isPending, isError } = useDoctors();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(doctor: Doctor) {
    setEditing(doctor);
    setDialogOpen(true);
  }

  return (
    <ProfileSection title="Doctors" addLabel="Add doctor" onAdd={openAdd}>
      {isPending && <p className="text-sm text-muted-foreground">Loading your doctors…</p>}
      {isError && (
        <p className="text-sm text-destructive">
          We couldn't load your doctors. Please refresh the page.
        </p>
      )}
      {!isPending && !isError && (doctors ?? []).length === 0 && (
        <p className="text-muted-foreground">
          No doctors saved. Add your doctors to reach them quickly.
        </p>
      )}
      {(doctors ?? []).length > 0 && (
        <ul className="flex flex-col gap-3">
          {doctors?.map((doctor) => (
            <DoctorCard key={doctor.id} doctor={doctor} onEdit={openEdit} />
          ))}
        </ul>
      )}

      <DoctorDialog open={dialogOpen} onClose={() => setDialogOpen(false)} doctor={editing} />
    </ProfileSection>
  );
}
