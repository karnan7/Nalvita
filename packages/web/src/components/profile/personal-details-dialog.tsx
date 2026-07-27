import {
  BLOOD_GROUPS,
  GENDERS,
  type BloodGroup,
  type Gender,
  type Profile,
} from '@nalvita/core';
import { useEffect, useState, type SyntheticEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { GENDER_LABELS, useUpdateProfile } from '@/lib/profile';

interface PersonalDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  profile: Profile;
}

interface FormValues {
  full_name: string;
  date_of_birth: string;
  gender: Gender | '';
  blood_group: BloodGroup | '';
  height_cm: string;
  weight_kg: string;
}

function formFromProfile(profile: Profile): FormValues {
  return {
    full_name: profile.full_name ?? '',
    date_of_birth: profile.date_of_birth ?? '',
    gender: profile.gender ?? '',
    blood_group: profile.blood_group ?? '',
    height_cm: profile.height_cm === null ? '' : String(profile.height_cm),
    weight_kg: profile.weight_kg === null ? '' : String(profile.weight_kg),
  };
}

export function PersonalDetailsDialog({
  open,
  onClose,
  profile,
}: Readonly<PersonalDetailsDialogProps>) {
  const update = useUpdateProfile(profile.user_id);
  const [form, setForm] = useState<FormValues>(() => formFromProfile(profile));

  useEffect(() => {
    if (open) setForm(formFromProfile(profile));
  }, [open, profile]);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function close() {
    update.reset();
    onClose();
  }

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    update.mutate(
      {
        full_name: form.full_name.trim(),
        date_of_birth: form.date_of_birth || null,
        gender: form.gender === '' ? null : form.gender,
        blood_group: form.blood_group === '' ? null : form.blood_group,
        height_cm: form.height_cm === '' ? null : Number(form.height_cm),
        weight_kg: form.weight_kg === '' ? null : Number(form.weight_kg),
      },
      { onSuccess: close },
    );
  }

  const submitError = update.isError ? "We couldn't save your details. Please try again." : null;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Modal open={open} onClose={close} title="Edit personal details">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-name">Full name</Label>
          <Input
            id="profile-name"
            autoComplete="name"
            required
            value={form.full_name}
            onChange={(event) => set('full_name', event.target.value)}
          />
        </div>

        <div className="flex gap-4">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="profile-dob">Date of birth</Label>
            <Input
              id="profile-dob"
              type="date"
              max={today}
              value={form.date_of_birth}
              onChange={(event) => set('date_of_birth', event.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="profile-gender">Gender</Label>
            <Select
              id="profile-gender"
              value={form.gender}
              onChange={(event) => set('gender', event.target.value as Gender | '')}
            >
              <option value="">Prefer not to say</option>
              {GENDERS.map((value) => (
                <option key={value} value={value}>
                  {GENDER_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="profile-blood">Blood group</Label>
            <Select
              id="profile-blood"
              value={form.blood_group}
              onChange={(event) => set('blood_group', event.target.value as BloodGroup | '')}
            >
              <option value="">Not sure</option>
              {BLOOD_GROUPS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="profile-height">Height (cm)</Label>
            <Input
              id="profile-height"
              type="number"
              min="1"
              step="0.1"
              value={form.height_cm}
              onChange={(event) => set('height_cm', event.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="profile-weight">Weight (kg)</Label>
            <Input
              id="profile-weight"
              type="number"
              min="1"
              step="0.1"
              value={form.weight_kg}
              onChange={(event) => set('weight_kg', event.target.value)}
            />
          </div>
        </div>

        {submitError && <p className="text-sm text-destructive">{submitError}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save details'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
