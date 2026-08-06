import { AllergySection } from '@/components/profile/allergy-section';
import { ConditionSection } from '@/components/profile/condition-section';
import { DoctorSection } from '@/components/profile/doctor-section';
import { PersonalDetailsSection } from '@/components/profile/personal-details-section';
import { useActiveProfile } from '@/lib/active-profile-context';
import { useProfileById } from '@/lib/profile';

export default function ProfilePage() {
  const { profileId, isSelf } = useActiveProfile();
  const { data: profile, isPending, isError } = useProfileById(profileId);

  const title = isSelf ? 'My profile' : `${profile?.full_name?.trim() || 'Their'} profile`;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>

      {isPending && <p className="text-sm text-muted-foreground">Loading the profile…</p>}
      {isError && (
        <p className="text-sm text-destructive">
          We couldn't load this profile. Please refresh the page.
        </p>
      )}

      {profile && (
        <>
          <PersonalDetailsSection profile={profile} />
          <AllergySection />
          <ConditionSection />
          <DoctorSection />
        </>
      )}
    </div>
  );
}
