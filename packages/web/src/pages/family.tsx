import { MAX_MANAGED_PROFILES, type CirclePerson, type Profile } from '@nalvita/core';
import { UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { FamilyCard } from '@/components/family/family-card';
import { HandoverDialog } from '@/components/family/handover-dialog';
import { ManagedProfileDialog } from '@/components/family/managed-profile-dialog';
import { EmptyState, SectionCard, StatusBadge } from '@/components/ui-nalvita';
import { Button } from '@/components/ui/button';
import { isAtProfileCap, managedName, remainingProfileSlots, useActiveProfile, useAuth, useCirclePeople, useFamilyOverview, useManagedProfiles, useProfileClaims, viewingManagedProfile, type FamilySummary } from '@nalvita/data';

/** Which dialog is open, and for whom. */
type Dialog =
  | { kind: 'none' }
  | { kind: 'add' }
  | { kind: 'edit'; profile: Profile }
  | { kind: 'handover'; profile: Profile };

/**
 * The caregiver's morning screen: one card per person whose records I can
 * reach, with anything needing attention surfaced as a chip. Tapping a card
 * switches the whole app into that person's records.
 *
 * Two kinds of people appear here — those who invited me into their circle, and
 * those I look after who have no account at all. They are deliberately the same
 * card: from where I stand the difference is only who holds the password.
 */
export default function FamilyPage() {
  const { session } = useAuth();
  const { data: people, isPending, isError } = useCirclePeople();
  const { data: managed, isPending: managedPending } = useManagedProfiles(session?.user.id);
  const { data: claims } = useProfileClaims();
  const { setViewing } = useActiveProfile();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });

  // Circles I belong to — other people's accounts I can help with. My own
  // circle (people who can see *my* records) is managed on the sharing screen.
  const iCanHelp = useMemo(
    () =>
      (people ?? []).filter(
        (person: CirclePerson) => person.direction === 'member' && person.status === 'active',
      ),
    [people],
  );

  const managedPeople = useMemo(
    () => (managed ?? []).map(viewingManagedProfile),
    [managed],
  );

  const { summaries, isPending: summariesPending } = useFamilyOverview(iCanHelp);
  const { summaries: managedSummaries } = useFamilyOverview(managedPeople);

  const byId = useMemo(
    () => new Map((managed ?? []).map((profile) => [profile.id, profile])),
    [managed],
  );

  const awaiting = (claims ?? []).filter((claim) => claim.status === 'awaiting_manager');
  const loading = isPending || summariesPending || managedPending;
  const nothingAtAll = !loading && !isError && iCanHelp.length === 0 && managedPeople.length === 0;

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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/family/sharing">Sharing settings</Link>
          </Button>
          <Button
            onClick={() => setDialog({ kind: 'add' })}
            disabled={isAtProfileCap(managed)}
            title={
              isAtProfileCap(managed)
                ? `You can look after up to ${MAX_MANAGED_PROFILES} profiles.`
                : undefined
            }
          >
            <UserPlus />
            Add a profile
          </Button>
        </div>
      </div>

      {awaiting.map((claim) => (
        <SectionCard key={claim.id} title="Someone wants to take over a profile">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-content-secondary">
              {claim.claimant_name?.trim() || 'Someone'} has asked to take over{' '}
              {claim.profile_name?.trim() || 'a profile'}. Nothing moves until you confirm.
            </p>
            {byId.has(claim.profile_id) && (
              <Button
                size="sm"
                onClick={() =>
                  setDialog({ kind: 'handover', profile: byId.get(claim.profile_id) as Profile })
                }
              >
                Review
              </Button>
            )}
          </div>
        </SectionCard>
      ))}

      {loading && <p className="text-sm text-content-muted">Loading your family…</p>}

      {isError && (
        <p className="text-sm text-destructive">
          We couldn&apos;t load your family. Please refresh the page.
        </p>
      )}

      {nothingAtAll && (
        <SectionCard title="Nobody has shared with you yet">
          <EmptyState
            icon={Users}
            title="No one to look after"
            description="When a family member invites you to their Health Circle, they'll appear here. You can also add a profile for someone who won't use the app themselves — an elderly parent, or a child."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setDialog({ kind: 'add' })}>Add a profile</Button>
                <Button variant="outline" asChild>
                  <Link to="/family/sharing">Invite family member</Link>
                </Button>
              </div>
            }
          />
        </SectionCard>
      )}

      {managedSummaries.length > 0 && (
        <div className="flex flex-col gap-3">
          {managedSummaries.map((summary) => {
            const profile = byId.get(summary.person.counterpart_id);
            if (!profile) return null;
            return (
              <FamilyCard
                key={profile.id}
                summary={summary}
                onOpen={open}
                badges={
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusBadge variant="normal">Managed by you</StatusBadge>
                    {profile.is_minor && <StatusBadge variant="low">Child</StatusBadge>}
                  </span>
                }
                actions={
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDialog({ kind: 'edit', profile })}
                    >
                      Edit details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDialog({ kind: 'handover', profile })}
                    >
                      {managedName(profile)} wants their own login
                    </Button>
                  </>
                }
              />
            );
          })}
          {!isAtProfileCap(managed) && (
            <p className="text-xs text-content-muted">
              You can add {remainingProfileSlots(managed)} more.
            </p>
          )}
        </div>
      )}

      {summaries.length > 0 && (
        <div className="flex flex-col gap-3">
          {summaries.map((summary) => (
            <FamilyCard key={summary.person.membership_id} summary={summary} onOpen={open} />
          ))}
        </div>
      )}

      <ManagedProfileDialog
        open={dialog.kind === 'add' || dialog.kind === 'edit'}
        onClose={() => setDialog({ kind: 'none' })}
        profile={dialog.kind === 'edit' ? dialog.profile : null}
      />
      {dialog.kind === 'handover' && (
        <HandoverDialog
          open
          onClose={() => setDialog({ kind: 'none' })}
          profile={dialog.profile}
        />
      )}
    </div>
  );
}
