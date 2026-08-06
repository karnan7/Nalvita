import type { Doctor } from '@nalvita/core';
import { useEffect, useState, type SyntheticEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { useActiveProfile } from '@/lib/active-profile-context';
import { useAddDoctor, useUpdateDoctor, type DoctorFormValues } from '@/lib/doctors';

interface DoctorDialogProps {
  open: boolean;
  onClose: () => void;
  /** When set, the form edits this doctor instead of adding a new one. */
  doctor?: Doctor | null;
}

function emptyForm(): DoctorFormValues {
  return { name: '', specialty: null, hospital: null, phone: null, email: null };
}

function formFromDoctor(doctor: Doctor): DoctorFormValues {
  return {
    name: doctor.name,
    specialty: doctor.specialty,
    hospital: doctor.hospital,
    phone: doctor.phone,
    email: doctor.email,
  };
}

export function DoctorDialog({ open, onClose, doctor }: Readonly<DoctorDialogProps>) {
  const { profileId } = useActiveProfile();
  const add = useAddDoctor(profileId);
  const update = useUpdateDoctor();
  const isEditing = Boolean(doctor);
  const mutation = isEditing ? update : add;

  const [form, setForm] = useState<DoctorFormValues>(emptyForm);

  useEffect(() => {
    if (open) setForm(doctor ? formFromDoctor(doctor) : emptyForm());
  }, [open, doctor]);

  function set<K extends keyof DoctorFormValues>(key: K, value: DoctorFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function close() {
    mutation.reset();
    onClose();
  }

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (isEditing && doctor) {
      update.mutate({ id: doctor.id, values: form }, { onSuccess: close });
    } else {
      add.mutate(form, { onSuccess: close });
    }
  }

  const submitError = mutation.isError ? "We couldn't save this doctor. Please try again." : null;

  return (
    <Modal open={open} onClose={close} title={isEditing ? 'Edit doctor' : 'Add doctor'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="doctor-name">Name</Label>
          <Input
            id="doctor-name"
            required
            placeholder="e.g. Dr Suresh Pillai"
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
          />
        </div>

        <div className="flex gap-4">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="doctor-specialty">Specialty (optional)</Label>
            <Input
              id="doctor-specialty"
              placeholder="e.g. Cardiologist"
              value={form.specialty ?? ''}
              onChange={(event) => set('specialty', event.target.value || null)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="doctor-hospital">Hospital / clinic (optional)</Label>
            <Input
              id="doctor-hospital"
              value={form.hospital ?? ''}
              onChange={(event) => set('hospital', event.target.value || null)}
            />
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="doctor-phone">Phone (optional)</Label>
            <Input
              id="doctor-phone"
              type="tel"
              value={form.phone ?? ''}
              onChange={(event) => set('phone', event.target.value || null)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="doctor-email">Email (optional)</Label>
            <Input
              id="doctor-email"
              type="email"
              value={form.email ?? ''}
              onChange={(event) => set('email', event.target.value || null)}
            />
          </div>
        </div>

        {submitError && <p className="text-sm text-destructive">{submitError}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save doctor'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
