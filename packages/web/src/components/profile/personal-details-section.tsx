import type { Profile } from '@nalvita/core';
import { Pencil } from 'lucide-react';
import { useState } from 'react';

import { PersonalDetailsDialog } from '@/components/profile/personal-details-dialog';
import { Button } from '@/components/ui/button';
import { GENDER_LABELS, computeAge, formatProfileDate } from '@nalvita/data';

function Field({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export function PersonalDetailsSection({ profile }: Readonly<{ profile: Profile }>) {
  const [editing, setEditing] = useState(false);

  const age = computeAge(profile.date_of_birth);
  const dob = profile.date_of_birth
    ? `${formatProfileDate(profile.date_of_birth)}${age !== null ? ` · ${age} yrs` : ''}`
    : '—';

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">{profile.full_name ?? 'Your name'}</h2>
            <p className="text-sm text-muted-foreground">Personal details</p>
          </div>
          {profile.blood_group && (
            <span className="rounded-lg bg-destructive/10 px-3 py-1 text-lg font-bold text-destructive">
              {profile.blood_group}
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil />
          Edit
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="Date of birth" value={dob} />
        <Field
          label="Gender"
          value={profile.gender ? GENDER_LABELS[profile.gender] : '—'}
        />
        <Field label="Blood group" value={profile.blood_group ?? '—'} />
        <Field
          label="Height"
          value={profile.height_cm === null ? '—' : `${profile.height_cm} cm`}
        />
        <Field
          label="Weight"
          value={profile.weight_kg === null ? '—' : `${profile.weight_kg} kg`}
        />
      </dl>

      <PersonalDetailsDialog open={editing} onClose={() => setEditing(false)} profile={profile} />
    </section>
  );
}
