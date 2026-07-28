import { AllergyBanner } from '@/components/dashboard/allergy-banner';
import { MedicinesCard } from '@/components/dashboard/medicines-card';
import { RecentDocumentsCard } from '@/components/dashboard/recent-documents-card';
import { StatCards } from '@/components/dashboard/stat-cards';
import { TimelineCard } from '@/components/dashboard/timeline-card';
import { VitalsCard } from '@/components/dashboard/vitals-card';
import { useAuth } from '@/lib/auth-context';
import { useProfile } from '@/lib/profile';

export default function DashboardPage() {
  const { session } = useAuth();
  const { data: profile } = useProfile(session?.user.id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">
        {profile?.full_name ? `Hello, ${profile.full_name}` : 'Hello'}
      </h1>

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
