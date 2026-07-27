import { AllergySection } from '@/components/profile/allergy-section';
import { ConditionSection } from '@/components/profile/condition-section';
import { DoctorSection } from '@/components/profile/doctor-section';
import { PersonalDetailsSection } from '@/components/profile/personal-details-section';
import { useAuth } from '@/lib/auth-context';
import { useProfile } from '@/lib/profile';

export default function ProfilePage() {
  const { session } = useAuth();
  const { data: profile, isPending, isError } = useProfile(session?.user.id);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold tracking-tight">My profile</h1>

      {isPending && <p className="text-sm text-muted-foreground">Loading your profile…</p>}
      {isError && (
        <p className="text-sm text-destructive">
          We couldn't load your profile. Please refresh the page.
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
