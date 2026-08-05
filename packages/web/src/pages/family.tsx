import type { CirclePerson } from '@nalvita/core';
import { Users } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { FamilyCard } from '@/components/family/family-card';
import { EmptyState, SectionCard } from '@/components/ui-nalvita';
import { Button } from '@/components/ui/button';
import { useActiveProfile } from '@/lib/active-profile-context';
import { useCirclePeople } from '@/lib/circle';
import { useFamilyOverview, type FamilySummary } from '@/lib/family-overview';

/**
 * The caregiver's morning screen: one card per person whose records I can
 * reach, with anything needing attention surfaced as a chip. Tapping a card
 * switches the whole app into that person's records.
 */
export default function FamilyPage() {
  const { data: people, isPending, isError } = useCirclePeople();
  const { setViewing } = useActiveProfile();
  const navigate = useNavigate();

  // Circles I belong to — other people's accounts I can help with. My own
  // circle (people who can see *my* records) is managed on the sharing screen.
  const iCanHelp = useMemo(
    () =>
      (people ?? []).filter(
        (person: CirclePerson) => person.direction === 'member' && person.status === 'active',
      ),
    [people],
  );

  const { summaries, isPending: summariesPending } = useFamilyOverview(iCanHelp);

  function open(summary: FamilySummary) {
    setViewing(summary.person);
    void navigate('/dashboard');
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-content">Family</h1>
          <p className="text-sm text-content-secondary">
            Everyone you help look after, and anything that needs you today.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/family/sharing">Sharing settings</Link>
        </Button>
      </div>

      {(isPending || summariesPending) && (
        <p className="text-sm text-content-muted">Loading your family…</p>
      )}

      {isError && (
        <p className="text-sm text-destructive">
          We couldn&apos;t load your family. Please refresh the page.
        </p>
      )}

      {!isPending && !isError && iCanHelp.length === 0 && (
        <SectionCard title="Nobody has shared with you yet">
          <EmptyState
            icon={Users}
            title="No one to look after"
            description="When a family member invites you to their Health Circle, they'll appear here. You can also invite someone to see yours."
            action={
              <Button asChild>
                <Link to="/family/sharing">Invite family member</Link>
              </Button>
            }
          />
        </SectionCard>
      )}

      {summaries.length > 0 && (
        <div className="flex flex-col gap-3">
          {summaries.map((summary) => (
            <FamilyCard key={summary.person.membership_id} summary={summary} onOpen={open} />
          ))}
        </div>
      )}
    </div>
  );
}
