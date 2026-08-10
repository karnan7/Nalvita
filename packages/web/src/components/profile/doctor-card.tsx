import type { Doctor } from '@nalvita/core';
import { Mail, Phone } from 'lucide-react';
import { useState } from 'react';

import { RecordActions } from '@/components/profile/record-actions';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useDeleteDoctor } from '@nalvita/data';

interface DoctorCardProps {
  doctor: Doctor;
  onEdit: (doctor: Doctor) => void;
}

export function DoctorCard({ doctor, onEdit }: Readonly<DoctorCardProps>) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteDoctor = useDeleteDoctor();

  function confirmDelete() {
    deleteDoctor.mutate(doctor.id, { onSuccess: () => setConfirmingDelete(false) });
  }

  const affiliation = [doctor.specialty, doctor.hospital].filter(Boolean);

  return (
    <li className="flex flex-col gap-3 rounded-lg border p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium">{doctor.name}</p>
        {affiliation.length > 0 && (
          <p className="text-sm text-muted-foreground">{affiliation.join(' · ')}</p>
        )}
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {doctor.phone && (
            <a
              href={`tel:${doctor.phone}`}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <Phone className="size-4" />
              {doctor.phone}
            </a>
          )}
          {doctor.email && (
            <a
              href={`mailto:${doctor.email}`}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <Mail className="size-4" />
              {doctor.email}
            </a>
          )}
        </div>
      </div>
      <RecordActions
        onEdit={() => onEdit(doctor)}
        onDelete={() => setConfirmingDelete(true)}
        deleteLabel={`Delete ${doctor.name}`}
      />

      <Modal
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete doctor?"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{doctor.name}</span> will be permanently
            removed from your profile.
          </p>
          {deleteDoctor.isError && (
            <p className="text-sm text-destructive">We couldn't delete it. Please try again.</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleteDoctor.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteDoctor.isPending}
            >
              {deleteDoctor.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </li>
  );
}
