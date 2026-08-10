import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

import { CodeEntry, LinkOutcome, LinkPage } from '@/components/link-page';
import { Button } from '@/components/ui/button';
import { CIRCLE_ROLE_DESCRIPTIONS, CIRCLE_ROLE_LABELS, describeCategories, useAcceptInvite, useAuth, useDeclineInvite, useInvitePreview } from '@nalvita/data';

/** Ask the invitee to sign in first, returning them to this same invite after. */
function SignInPrompt() {
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;
  return (
    <div className="flex flex-col gap-4 text-center">
      <h2 className="font-heading text-xl font-bold text-content">You&apos;ve been invited</h2>
      <p className="text-sm text-content-secondary">
        Someone wants to add you to their Health Circle on Nalvita. Sign in or create your free
        account to see what they&apos;re sharing and respond.
      </p>
      <Button asChild>
        <Link to={`/login?redirect=${encodeURIComponent(returnTo)}`}>Sign in to continue</Link>
      </Button>
    </div>
  );
}

export default function JoinInvitePage() {
  const { session, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('token');
  const [codeSecret, setCodeSecret] = useState<string | null>(null);
  const secret = tokenParam ?? codeSecret;

  const preview = useInvitePreview(session ? secret : null);
  const accept = useAcceptInvite();
  const decline = useDeclineInvite();
  const [outcome, setOutcome] = useState<'idle' | 'accepted' | 'declined'>('idle');

  if (loading) return <LinkPage>{null}</LinkPage>;
  if (!session) {
    return (
      <LinkPage>
        <SignInPrompt />
      </LinkPage>
    );
  }

  if (!secret) {
    return (
      <LinkPage>
        <CodeEntry label="Enter your invite code" onSubmit={setCodeSecret} />
      </LinkPage>
    );
  }

  if (outcome === 'accepted') {
    return (
      <LinkPage>
        <LinkOutcome title="You&apos;re connected" to="/family" label="Go to Family">
          You now have access to the records they shared. You can leave this circle anytime from
          your Family page.
        </LinkOutcome>
      </LinkPage>
    );
  }

  if (outcome === 'declined') {
    return (
      <LinkPage>
        <LinkOutcome title="Invite declined" to="/dashboard" label="Go to my records" muted>
          No problem — nothing was shared and no connection was made.
        </LinkOutcome>
      </LinkPage>
    );
  }

  if (preview.isPending) {
    return (
      <LinkPage>
        <p className="text-center text-sm text-content-muted">Checking your invite…</p>
      </LinkPage>
    );
  }

  if (preview.isError || !preview.data) {
    return (
      <LinkPage>
        <LinkOutcome title="Invite not found" to="/dashboard" label="Go to my records" muted>
          This invite is invalid or has expired. Ask your family member to send you a new one.
        </LinkOutcome>
      </LinkPage>
    );
  }

  const { owner_name, requested_role, requested_categories } = preview.data;
  const inviter = owner_name?.trim() || 'A family member';
  const actionError =
    accept.isError || decline.isError
      ? "We couldn't complete that. Please try again."
      : null;

  return (
    <LinkPage>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-xl font-bold text-content">
            {inviter} wants to add you to their Health Circle
          </h2>
          <p className="text-sm text-content-secondary">
            Here&apos;s exactly what you&apos;ll be able to do. You can leave anytime, and they can
            end your access anytime.
          </p>
        </div>

        <dl className="flex flex-col gap-3 rounded-xl bg-sunken p-4">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-content-muted">
              Your access
            </dt>
            <dd className="text-sm text-content">
              {CIRCLE_ROLE_LABELS[requested_role]} — {CIRCLE_ROLE_DESCRIPTIONS[requested_role]}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-content-muted">
              You&apos;ll see
            </dt>
            <dd className="text-sm text-content">{describeCategories(requested_categories)}</dd>
          </div>
        </dl>

        {actionError && <p className="text-sm text-destructive">{actionError}</p>}

        <div className="flex flex-col gap-2">
          <Button
            disabled={accept.isPending || decline.isPending}
            onClick={() =>
              secret && accept.mutate(secret, { onSuccess: () => setOutcome('accepted') })
            }
          >
            {accept.isPending ? 'Accepting…' : 'Accept'}
          </Button>
          <Button
            variant="outline"
            disabled={accept.isPending || decline.isPending}
            onClick={() =>
              secret && decline.mutate(secret, { onSuccess: () => setOutcome('declined') })
            }
          >
            Decline
          </Button>
        </div>
      </div>
    </LinkPage>
  );
}
