import type { CirclePerson } from '@nalvita/core';
import { Users } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ActivityFeed } from '@/components/family/activity-feed';
import { InviteDialog } from '@/components/family/invite-dialog';
import { ManageAccessDialog } from '@/components/family/manage-access-dialog';
import { EmptyState, SectionCard, StatusBadge } from '@/components/ui-nalvita';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { CIRCLE_ROLE_LABELS, describeCategories, useCancelInvite, useCirclePeople, usePendingInvites, useRevokeMembership } from '@nalvita/data';

function displayName(name: string | null): string {
  return name?.trim() || 'Family member';
}

/** "Sharing since 20 Jul 2026" — the date the person accepted. */
function sinceLabel(accepted_at: string | null): string | null {
  if (!accepted_at) return null;
  const date = new Date(accepted_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return `Sharing since ${date}`;
}

/** A person who has access to my records: what they can see, and how to change it. */
function MemberRow({
  person,
  onManage,
  onRevoke,
}: Readonly<{
  person: CirclePerson;
  onManage: (person: CirclePerson) => void;
  onRevoke: (person: CirclePerson) => void;
}>) {
  const isRevoked = person.status === 'revoked';
  const since = sinceLabel(person.accepted_at);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-app px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-content">{displayName(person.counterpart_name)}</p>
        <p className="text-sm text-content-muted">
          {CIRCLE_ROLE_LABELS[person.role]} · {describeCategories(person.shared_categories)}
        </p>
        {since && <p className="text-xs text-content-muted">{since}</p>}
      </div>
      {isRevoked ? (
        <StatusBadge variant="critical">Access ended</StatusBadge>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onManage(person)}>
            Change access
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onRevoke(person)}>
            Remove access
          </Button>
        </div>
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

/** Removing someone is instant and one-sided, so it always asks first. */
function RevokeConfirm({
  person,
  onClose,
}: Readonly<{ person: CirclePerson | null; onClose: () => void }>) {
  const revoke = useRevokeMembership();
  const name = person ? displayName(person.counterpart_name) : '';

  function confirm() {
    if (!person) return;
    revoke.mutate(person.membership_id, { onSuccess: onClose });
  }

  return (
    <Modal open={person !== null} onClose={onClose} title="Remove access?">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-content-secondary">
          {name} will no longer be able to see or add anything in your account. You can invite them
          again later.
        </p>
        {revoke.isError && (
          <p className="text-sm text-destructive">
            We couldn&apos;t remove this person. Please try again.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Keep access
          </Button>
          <Button type="button" disabled={revoke.isPending} onClick={confirm}>
            {revoke.isPending ? 'Removing…' : 'Remove access'}
          </Button>
        </div>
      </div>
    </Modal>
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
              <p className="font-medium text-content">{invite.invitee_email ?? 'Invite link'}</p>
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

export default function FamilySharingPage() {
  const { data: people, isPending, isError } = useCirclePeople();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [managing, setManaging] = useState<CirclePerson | null>(null);
  const [revoking, setRevoking] = useState<CirclePerson | null>(null);

  const myCircle = useMemo(() => (people ?? []).filter((p) => p.direction === 'owner'), [people]);
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
                  <MemberRow
                    key={person.membership_id}
                    person={person}
                    onManage={setManaging}
                    onRevoke={setRevoking}
                  />
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

          <ActivityFeed />
        </>
      )}

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <ManageAccessDialog person={managing} onClose={() => setManaging(null)} />
      <RevokeConfirm person={revoking} onClose={() => setRevoking(null)} />
    </div>
  );
}
