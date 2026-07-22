import { BLOOD_GROUPS, GENDERS, type BloodGroup, type Gender } from '@nalvita/core';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useAuth } from '@/lib/auth-context';
import { useUpdateProfile } from '@/lib/profile';

const GENDER_LABELS: Record<Gender, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
};

export default function OnboardingPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const userId = session?.user.id ?? '';
  const updateProfile = useUpdateProfile(userId);

  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>('');

  function submit(event: FormEvent) {
    event.preventDefault();
    updateProfile.mutate(
      {
        full_name: fullName.trim(),
        date_of_birth: dateOfBirth,
        gender: gender === '' ? null : gender,
        blood_group: bloodGroup === '' ? null : bloodGroup,
      },
      { onSuccess: () => void navigate('/', { replace: true }) },
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="w-full max-w-sm rounded-lg border p-6 shadow-sm">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <h1 className="text-lg font-semibold">Tell us about yourself</h1>
            <p className="text-sm text-muted-foreground">
              This helps keep your health records organized. You can change these details anytime.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="full-name">Full name</Label>
            <Input
              id="full-name"
              autoComplete="name"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="date-of-birth">Date of birth</Label>
            <Input
              id="date-of-birth"
              type="date"
              max={today}
              required
              value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gender">Gender</Label>
            <Select
              id="gender"
              required
              value={gender}
              onChange={(event) => setGender(event.target.value as Gender | '')}
            >
              <option value="" disabled>
                Choose one
              </option>
              {GENDERS.map((value) => (
                <option key={value} value={value}>
                  {GENDER_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="blood-group">Blood group</Label>
            <Select
              id="blood-group"
              value={bloodGroup}
              onChange={(event) => setBloodGroup(event.target.value as BloodGroup | '')}
            >
              <option value="">I'm not sure</option>
              {BLOOD_GROUPS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
          {updateProfile.isError && (
            <p className="text-sm text-destructive">
              We couldn't save your details. Please try again.
            </p>
          )}
          <Button type="submit" disabled={updateProfile.isPending}>
            Save and continue
          </Button>
        </form>
      </div>
    </main>
  );
}
