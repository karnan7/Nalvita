import { PROFILE_CLAIM_TTL_HOURS, type Profile, type ProfileClaimSummary } from '@nalvita/core';
import { useEffect, useState, type SyntheticEvent } from 'react';

import { CopyField } from '@/components/family/copy-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import {
  managedName,
  useCancelHandover,
  useConfirmHandover,
  useProfileClaims,
  useRejectHandover,
  useStartHandover,
  type CreatedClaim,
} from '@/lib/managed-profiles';

interface HandoverDialogProps {
  open: boolean;
  onClose: () => void;
  profile: Profile;
}

/** The link and code, shown once. Nothing can retrieve them afterwards. */
function CreatedClaimView({
  claim,
  name,
  onDone,
}: Readonly<{ claim: CreatedClaim; name: string; onDone: () => void }>) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-content-secondary">
        Send one of these to {name}. When they sign up and claim the profile, you&apos;ll be asked
        to confirm before anything moves. Valid for {PROFILE_CLAIM_TTL_HOURS} hours.
      </p>
      <CopyField label="6-digit code" value={claim.code} />
      <CopyField label="Claim link" value={claim.link} />
      <div className="flex justify-end">
        <Button type="button" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

/** The second half of the handshake: someone has claimed, and it is now yours to allow. */
function AwaitingManagerView({
  claim,
  name,
  onClose,
}: Readonly<{ claim: ProfileClaimSummary; name: string; onClose: () => void }>) {
  const confirm = useConfirmHandover();
  const reject = useRejectHandover();
  const claimant = claim.claimant_name?.trim() || 'Someone';
  const busy = confirm.isPending || reject.isPending;
  const failure = confirm.error ?? reject.error;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-content">
        <strong className="font-semibold">{claimant}</strong> has signed up and asked to take over{' '}
        {name}&apos;s profile.
      </p>
      <div className="flex flex-col gap-2 rounded-xl bg-sunken p-4 text-sm text-content-secondary">
        <p className="font-medium text-content">If you confirm:</p>
        <ul className="list-disc pl-5">
          <li>The profile and every record in it becomes theirs.</li>
          <li>You stay on as a caregiver — you can still view and add, but not delete.</li>
          <li>They can change or end your access at any time.</li>
        </ul>
      </div>
      <p className="text-sm text-content-secondary">
        Only confirm if you recognise this person. This cannot be undone from here.
      </p>

      {failure && (
        <p className="text-sm text-destructive">
          {failure.message || "We couldn't complete the handover. Please try again."}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => reject.mutate(claim.id, { onSuccess: onClose })}
        >
          That&apos;s not them
        </Button>
        <Button
          type="button"
          disabled={busy}
          onClick={() => confirm.mutate(claim.id, { onSuccess: onClose })}
        >
          {confirm.isPending ? 'Handing over…' : 'Confirm handover'}
        </Button>
      </div>
    </div>
  );
}

/** A claim that has been sent and not yet picked up. */
function PendingClaimView({
  claim,
  onClose,
}: Readonly<{ claim: ProfileClaimSummary; onClose: () => void }>) {
  const cancel = useCancelHandover();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-content-secondary">
        An invitation to take over this profile is already out
        {claim.invitee_email ? ` to ${claim.invitee_email}` : ''}. Nothing has moved — they
        haven&apos;t claimed it yet.
      </p>
      {cancel.isError && (
        <p className="text-sm text-destructive">We couldn&apos;t withdraw it. Please try again.</p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Leave it open
        </Button>
        <Button
          type="button"
          disabled={cancel.isPending}
          onClick={() => cancel.mutate(claim.id, { onSuccess: onClose })}
        >
          {cancel.isPending ? 'Withdrawing…' : 'Withdraw invitation'}
        </Button>
      </div>
    </div>
  );
}

/** Starting a handover: who to send it to. */
function StartHandoverForm({
  profile,
  name,
  onCreated,
  onClose,
}: Readonly<{
  profile: Profile;
  name: string;
  onCreated: (claim: CreatedClaim) => void;
  onClose: () => void;
}>) {
  const start = useStartHandover();
  const [email, setEmail] = useState('');

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    start.mutate({ profileId: profile.id, invitee_email: email }, { onSuccess: onCreated });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-sm text-content-secondary">
        Give {name} their own login. They sign up with their email, claim this profile, and
        everything you&apos;ve kept for them becomes theirs — nothing is lost. You stay on as a
        caregiver.
      </p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="handover-email">Their email (optional)</Label>
        <Input
          id="handover-email"
          type="email"
          placeholder="so you can tell handovers apart"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      {start.isError && (
        <p className="text-sm text-destructive">
          We couldn&apos;t start the handover. Please try again.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={start.isPending}>
          {start.isPending ? 'Creating…' : 'Create claim link'}
        </Button>
      </div>
    </form>
  );
}

/**
 * Handing a managed profile to the person it belongs to.
 *
 * Two-sided on purpose, and the manager answers last: the claimant consents
 * first, then the manager confirms against a named account. A link that reaches
 * the wrong person therefore cannot move anything on its own.
 */
export function HandoverDialog({ open, onClose, profile }: Readonly<HandoverDialogProps>) {
  const { data: claims } = useProfileClaims();
  const [created, setCreated] = useState<CreatedClaim | null>(null);
  const name = managedName(profile);

  useEffect(() => {
    if (open) setCreated(null);
  }, [open]);

  const live = claims?.find((claim) => claim.profile_id === profile.id) ?? null;

  function body() {
    if (created) return <CreatedClaimView claim={created} name={name} onDone={onClose} />;
    if (live?.status === 'awaiting_manager') {
      return <AwaitingManagerView claim={live} name={name} onClose={onClose} />;
    }
    if (live) return <PendingClaimView claim={live} onClose={onClose} />;
    return (
      <StartHandoverForm
        profile={profile}
        name={name}
        onCreated={setCreated}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={live?.status === 'awaiting_manager' ? 'Confirm handover' : `Invite ${name} to sign up`}
    >
      {body()}
    </Modal>
  );
}
