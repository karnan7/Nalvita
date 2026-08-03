import { useState, type SyntheticEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

import logoFullDark from '@/assets/logo-full-dark-4x.png';
import logoFullLight from '@/assets/logo-full-light-4x.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';
import {
  CIRCLE_ROLE_DESCRIPTIONS,
  CIRCLE_ROLE_LABELS,
  describeCategories,
  useAcceptInvite,
  useDeclineInvite,
  useInvitePreview,
} from '@/lib/circle';

function Card({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="flex items-center">
        <span className="sr-only">Nalvita</span>
        <img src={logoFullLight} alt="" className="h-16 w-auto dark:hidden" />
        <img src={logoFullDark} alt="" className="hidden h-16 w-auto dark:block" />
      </h1>
      <div className="w-full max-w-md rounded-2xl border border-border-default bg-surface p-6 shadow-sm">
        {children}
      </div>
    </main>
  );
}

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

/** Manual 6-digit code entry, when the person doesn't have the link. */
function CodeEntry({ onSubmit }: Readonly<{ onSubmit: (code: string) => void }>) {
  const [code, setCode] = useState('');

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (trimmed) onSubmit(trimmed);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="invite-code">Enter your invite code</Label>
        <Input
          id="invite-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="6-digit code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
      </div>
      <Button type="submit" disabled={!code.trim()}>
        Continue
      </Button>
    </form>
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

  if (loading) return <Card>{null}</Card>;
  if (!session) return <Card><SignInPrompt /></Card>;

  if (!secret) {
    return (
      <Card>
        <CodeEntry onSubmit={setCodeSecret} />
      </Card>
    );
  }

  if (outcome === 'accepted') {
    return (
      <Card>
        <div className="flex flex-col gap-4 text-center">
          <h2 className="font-heading text-xl font-bold text-content">You&apos;re connected</h2>
          <p className="text-sm text-content-secondary">
            You now have access to the records they shared. You can leave this circle anytime from
            your Family page.
          </p>
          <Button asChild>
            <Link to="/family">Go to Family</Link>
          </Button>
        </div>
      </Card>
    );
  }

  if (outcome === 'declined') {
    return (
      <Card>
        <div className="flex flex-col gap-4 text-center">
          <h2 className="font-heading text-xl font-bold text-content">Invite declined</h2>
          <p className="text-sm text-content-secondary">
            No problem — nothing was shared and no connection was made.
          </p>
          <Button asChild variant="outline">
            <Link to="/dashboard">Go to my records</Link>
          </Button>
        </div>
      </Card>
    );
  }

  if (preview.isPending) {
    return <Card><p className="text-center text-sm text-content-muted">Checking your invite…</p></Card>;
  }

  if (preview.isError || !preview.data) {
    return (
      <Card>
        <div className="flex flex-col gap-4 text-center">
          <h2 className="font-heading text-xl font-bold text-content">Invite not found</h2>
          <p className="text-sm text-content-secondary">
            This invite is invalid or has expired. Ask your family member to send you a new one.
          </p>
          <Button asChild variant="outline">
            <Link to="/dashboard">Go to my records</Link>
          </Button>
        </div>
      </Card>
    );
  }

  const { owner_name, requested_role, requested_categories } = preview.data;
  const inviter = owner_name?.trim() || 'A family member';
  const actionError =
    accept.isError || decline.isError
      ? "We couldn't complete that. Please try again."
      : null;

  return (
    <Card>
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
    </Card>
  );
}
