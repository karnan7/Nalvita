import { useState } from 'react';
import { useLocation, useSearchParams, Link } from 'react-router-dom';

import { CodeEntry, LinkOutcome, LinkPage } from '@/components/link-page';
import { Button } from '@/components/ui/button';
import { computeAge, useAcceptClaim, useAuth, useClaimPreview, useDeclineClaim } from '@nalvita/data';

/** Ask them to sign in first, returning here afterwards. */
function SignInPrompt() {
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;
  return (
    <div className="flex flex-col gap-4 text-center">
      <h2 className="font-heading text-xl font-bold text-content">Your health records</h2>
      <p className="text-sm text-content-secondary">
        Someone has been keeping health records for you on Nalvita and wants to hand them over.
        Create your free account — or sign in — to see what&apos;s there and decide.
      </p>
      <Button asChild>
        <Link to={`/login?redirect=${encodeURIComponent(returnTo)}`}>Sign in to continue</Link>
      </Button>
    </div>
  );
}

/** "Meera, 71 — 24 records" — enough to recognise, nothing clinical. */
function profileLine(name: string, dateOfBirth: string | null): string {
  const age = computeAge(dateOfBirth);
  return age === null ? name : `${name}, ${age}`;
}

function recordLine(count: number): string {
  if (count === 0) return 'No records yet';
  return count === 1 ? '1 record' : `${count} records`;
}

/**
 * Taking over a profile someone has been keeping for you.
 *
 * Agreeing here is only half of it: the person who has been looking after the
 * records confirms afterwards, against your name. Nothing moves until they do,
 * which is what stops a stray link from moving anybody's records anywhere.
 */
export default function ClaimProfilePage() {
  const { session, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('token');
  const [codeSecret, setCodeSecret] = useState<string | null>(null);
  const secret = tokenParam ?? codeSecret;

  const preview = useClaimPreview(session ? secret : null);
  const accept = useAcceptClaim();
  const decline = useDeclineClaim();
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
        <CodeEntry label="Enter your code" onSubmit={setCodeSecret} />
      </LinkPage>
    );
  }

  if (outcome === 'accepted') {
    return (
      <LinkPage>
        <LinkOutcome title="Almost there" to="/dashboard" label="Go to my records">
          We&apos;ve let them know. Once they confirm it&apos;s you, the profile and everything in
          it becomes yours — you&apos;ll see it next time you open Nalvita.
        </LinkOutcome>
      </LinkPage>
    );
  }

  if (outcome === 'declined') {
    return (
      <LinkPage>
        <LinkOutcome title="No problem" to="/dashboard" label="Go to my records" muted>
          Nothing was moved. They&apos;ll carry on keeping those records as before.
        </LinkOutcome>
      </LinkPage>
    );
  }

  if (preview.isPending) {
    return (
      <LinkPage>
        <p className="text-center text-sm text-content-muted">Checking your link…</p>
      </LinkPage>
    );
  }

  if (preview.isError || !preview.data) {
    return (
      <LinkPage>
        <LinkOutcome title="Link not found" to="/dashboard" label="Go to my records" muted>
          This link is invalid or has expired. Ask the person looking after these records to send
          you a new one.
        </LinkOutcome>
      </LinkPage>
    );
  }

  const { profile_name, date_of_birth, manager_name, record_count, already_claimed } = preview.data;
  const person = profile_name?.trim() || 'This profile';
  const keeper = manager_name?.trim() || 'A family member';
  const actionError =
    accept.error ?? decline.error
      ? ((accept.error ?? decline.error)?.message ?? "We couldn't complete that. Please try again.")
      : null;

  if (already_claimed) {
    return (
      <LinkPage>
        <LinkOutcome title="Waiting on them" to="/dashboard" label="Go to my records">
          You&apos;ve already asked for this profile. {keeper} needs to confirm before it moves
          across.
        </LinkOutcome>
      </LinkPage>
    );
  }

  return (
    <LinkPage>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-xl font-bold text-content">
            {keeper} wants to hand these records to you
          </h2>
          <p className="text-sm text-content-secondary">
            They&apos;ve been keeping a health profile on your behalf. If this is you, it becomes
            yours — nothing in it is lost.
          </p>
        </div>

        <dl className="flex flex-col gap-3 rounded-xl bg-sunken p-4">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-content-muted">
              The profile
            </dt>
            <dd className="text-sm text-content">{profileLine(person, date_of_birth)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-content-muted">
              What&apos;s in it
            </dt>
            <dd className="text-sm text-content">{recordLine(record_count)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-content-muted">
              Afterwards
            </dt>
            <dd className="text-sm text-content">
              {keeper} stays on as a caregiver — able to view and add, but not delete. You can
              change or end that at any time.
            </dd>
          </div>
        </dl>

        <p className="text-sm text-content-secondary">
          {keeper} will be asked to confirm it&apos;s you before anything moves.
        </p>

        {actionError && <p className="text-sm text-destructive">{actionError}</p>}

        <div className="flex flex-col gap-2">
          <Button
            disabled={accept.isPending || decline.isPending}
            onClick={() =>
              secret && accept.mutate(secret, { onSuccess: () => setOutcome('accepted') })
            }
          >
            {accept.isPending ? 'Sending…' : 'Yes, this is me'}
          </Button>
          <Button
            variant="outline"
            disabled={accept.isPending || decline.isPending}
            onClick={() =>
              secret && decline.mutate(secret, { onSuccess: () => setOutcome('declined') })
            }
          >
            Not me
          </Button>
        </div>
      </div>
    </LinkPage>
  );
}
