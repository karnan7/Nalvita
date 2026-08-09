import {
  BLOOD_GROUPS,
  GENDERS,
  type BloodGroup,
  type Gender,
  type ManagedProfileInsert,
  type Profile,
} from '@nalvita/core';
import { useEffect, useState, type SyntheticEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { useAuth } from '@/lib/auth-context';
import { useCreateManagedProfile, useUpdateManagedProfile } from '@/lib/managed-profiles';
import { GENDER_LABELS } from '@/lib/profile';

interface ManagedProfileDialogProps {
  open: boolean;
  onClose: () => void;
  /** The profile being edited, or null when adding someone new. */
  profile: Profile | null;
}

interface FormValues {
  full_name: string;
  date_of_birth: string;
  gender: Gender | '';
  blood_group: BloodGroup | '';
  is_minor: boolean;
}

function emptyForm(): FormValues {
  return { full_name: '', date_of_birth: '', gender: '', blood_group: '', is_minor: false };
}

function formFrom(profile: Profile | null): FormValues {
  if (!profile) return emptyForm();
  return {
    full_name: profile.full_name ?? '',
    date_of_birth: profile.date_of_birth ?? '',
    gender: profile.gender ?? '',
    blood_group: profile.blood_group ?? '',
    is_minor: profile.is_minor,
  };
}

function toInsert(form: FormValues): ManagedProfileInsert {
  return {
    full_name: form.full_name.trim(),
    date_of_birth: form.date_of_birth || null,
    gender: form.gender === '' ? null : form.gender,
    blood_group: form.blood_group === '' ? null : form.blood_group,
    is_minor: form.is_minor,
  };
}

/**
 * Add or edit someone you look after who has no account of their own.
 *
 * Only asks for what a caregiver plausibly knows without the person present —
 * everything else can be filled in from their own screens later.
 */
export function ManagedProfileDialog({
  open,
  onClose,
  profile,
}: Readonly<ManagedProfileDialogProps>) {
  const { session } = useAuth();
  const create = useCreateManagedProfile(session?.user.id ?? '');
  const update = useUpdateManagedProfile();
  const [form, setForm] = useState<FormValues>(emptyForm);

  useEffect(() => {
    if (open) setForm(formFrom(profile));
  }, [open, profile]);

  const pending = create.isPending || update.isPending;
  // The cap is a database trigger, so its message is the honest one to show.
  const failure = create.error ?? update.error;
  const submitError = failure
    ? (failure.message ?? "We couldn't save this profile. Please try again.")
    : null;

  function close() {
    create.reset();
    update.reset();
    onClose();
  }

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (!form.full_name.trim()) return;
    const values = toInsert(form);
    if (profile) update.mutate({ profileId: profile.id, values }, { onSuccess: close });
    else create.mutate(values, { onSuccess: close });
  }

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Modal
      open={open}
      onClose={close}
      title={profile ? 'Edit their details' : 'Add someone you look after'}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        {!profile && (
          <p className="text-sm text-content-secondary">
            For a family member who won&apos;t use the app themselves. They don&apos;t need an email
            or a login — you keep their records, and they can take the profile over later if they
            ever want to.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="managed-name">Their name</Label>
          <Input
            id="managed-name"
            required
            autoComplete="off"
            value={form.full_name}
            onChange={(event) => set('full_name', event.target.value)}
          />
        </div>

        <div className="flex gap-4">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="managed-dob">Date of birth</Label>
            <Input
              id="managed-dob"
              type="date"
              max={today}
              value={form.date_of_birth}
              onChange={(event) => set('date_of_birth', event.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="managed-gender">Gender</Label>
            <Select
              id="managed-gender"
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

        <div className="flex flex-col gap-2">
          <Label htmlFor="managed-blood">Blood group</Label>
          <Select
            id="managed-blood"
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

        <label
          htmlFor="managed-minor"
          className="flex items-start gap-3 rounded-xl bg-sunken p-3 text-sm text-content"
        >
          <input
            id="managed-minor"
            type="checkbox"
            className="mt-0.5 size-4 accent-interactive"
            checked={form.is_minor}
            onChange={(event) => set('is_minor', event.target.checked)}
          />
          <span>
            This is a child
            <span className="block text-content-secondary">
              Their profile is labelled as a child&apos;s. They can take it over themselves when
              they&apos;re older.
            </span>
          </span>
        </label>

        {submitError && <p className="text-sm text-destructive">{submitError}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !form.full_name.trim()}>
            {pending ? 'Saving…' : (profile ?? false) ? 'Save details' : 'Add profile'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
