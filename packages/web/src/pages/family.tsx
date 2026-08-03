import type { CirclePerson } from '@nalvita/core';
import { Users } from 'lucide-react';
import { useMemo, useState } from 'react';

import { InviteDialog } from '@/components/family/invite-dialog';
import { EmptyState, SectionCard, StatusBadge } from '@/components/ui-nalvita';
import { Button } from '@/components/ui/button';
import {
  CIRCLE_ROLE_LABELS,
  describeCategories,
  useCancelInvite,
  useCirclePeople,
  usePendingInvites,
  useRevokeMembership,
} from '@/lib/circle';

function displayName(name: string | null): string {
  return name?.trim() || 'Family member';
}

/** A person who has access to my records, with a one-tap revoke. */
function MemberRow({ person }: Readonly<{ person: CirclePerson }>) {
  const revoke = useRevokeMembership();
  const isRevoked = person.status === 'revoked';

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-app px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-content">{displayName(person.counterpart_name)}</p>
        <p className="text-sm text-content-muted">
          {CIRCLE_ROLE_LABELS[person.role]} · {describeCategories(person.shared_categories)}
        </p>
      </div>
      {isRevoked ? (
        <StatusBadge variant="critical">Access ended</StatusBadge>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={revoke.isPending}
          onClick={() => revoke.mutate(person.membership_id)}
        >
          Remove access
        </Button>
      )}
    </li>
  );
}

/** A circle I belong to; a revoked one shows a gentle message, not an error. */
function MembershipRow({ person }: Readonly<{ person: CirclePerson }>) {
  const isRevoked = person.status === 'revoked';
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-app px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-content">{displayName(person.counterpart_name)}</p>
        <p className="text-sm text-content-muted">
          {isRevoked
            ? 'This access has ended.'
            : `${CIRCLE_ROLE_LABELS[person.role]} · ${describeCategories(person.shared_categories)}`}
        </p>
      </div>
      <StatusBadge variant={isRevoked ? 'critical' : 'normal'}>
        {isRevoked ? 'Ended' : 'Active'}
      </StatusBadge>
    </li>
  );
}

function PendingInvites() {
  const { data: invites } = usePendingInvites();
  const cancel = useCancelInvite();

  if (!invites || invites.length === 0) return null;

  return (
    <SectionCard title="Pending invites">
      <ul className="flex flex-col gap-2">
        {invites.map((invite) => (
          <li
            key={invite.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-app px-4 py-3"
          >
            <div className="min-w-0">
              <p className="font-medium text-content">
                {invite.invitee_email ?? 'Invite link'}
              </p>
              <p className="text-sm text-content-muted">
                {CIRCLE_ROLE_LABELS[invite.requested_role]} ·{' '}
                {describeCategories(invite.requested_categories)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge variant="high">Waiting</StatusBadge>
              <Button
                variant="ghost"
                size="sm"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate(invite.id)}
              >
                Cancel
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

export default function FamilyPage() {
  const { data: people, isPending, isError } = useCirclePeople();
  const [inviteOpen, setInviteOpen] = useState(false);

  const myCircle = useMemo(
    () => (people ?? []).filter((p) => p.direction === 'owner'),
    [people],
  );
  const circlesImIn = useMemo(
    () => (people ?? []).filter((p) => p.direction === 'member'),
    [people],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-content">Family</h1>
          <p className="text-sm text-content-secondary">
            Share your records with people you trust — with their consent, and revocable anytime.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>Invite family member</Button>
      </div>

      {isPending && <p className="text-sm text-content-muted">Loading your circle…</p>}
      {isError && (
        <p className="text-sm text-destructive">
          We couldn&apos;t load your circle. Please refresh the page.
        </p>
      )}

      {!isPending && !isError && (
        <>
          <PendingInvites />

          <SectionCard title="People in your circle">
            {myCircle.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No one yet"
                description="Invite a family member to view or help manage your records."
                action={<Button onClick={() => setInviteOpen(true)}>Invite family member</Button>}
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {myCircle.map((person) => (
                  <MemberRow key={person.membership_id} person={person} />
                ))}
              </ul>
            )}
          </SectionCard>

          {circlesImIn.length > 0 && (
            <SectionCard title="Circles you're in">
              <ul className="flex flex-col gap-2">
                {circlesImIn.map((person) => (
                  <MembershipRow key={person.membership_id} person={person} />
                ))}
              </ul>
            </SectionCard>
          )}
        </>
      )}

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
