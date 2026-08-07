import { AllergyBanner } from '@/components/dashboard/allergy-banner';
import { MedicinesCard } from '@/components/dashboard/medicines-card';
import { RecentDocumentsCard } from '@/components/dashboard/recent-documents-card';
import { StatCards } from '@/components/dashboard/stat-cards';
import { TimelineCard } from '@/components/dashboard/timeline-card';
import { VitalsCard } from '@/components/dashboard/vitals-card';
import { useActiveProfile } from '@/lib/active-profile-context';
import { useProfileById } from '@/lib/profile';

export default function DashboardPage() {
  const { profileId, isSelf } = useActiveProfile();
  const { data: profile } = useProfileById(profileId);

  // Greeting only makes sense in your own account; in someone else's the
  // heading says whose records these are, and the banner above repeats it.
  let heading = 'Hello';
  if (!isSelf) heading = profile?.full_name ? `${profile.full_name}'s health` : 'Their health';
  else if (profile?.full_name) heading = `Hello, ${profile.full_name}`;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>

      <AllergyBanner />
      <StatCards />

      <div className="grid gap-4 sm:grid-cols-2">
        <RecentDocumentsCard />
        <MedicinesCard />
        <VitalsCard />
        <TimelineCard />
      </div>
    </div>
  );
}
