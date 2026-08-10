import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

import logoFullDark from '@/assets/logo-full-dark-4x.png';
import logoFullLight from '@/assets/logo-full-light-4x.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@nalvita/data';
import { supabase } from '@/lib/supabase';

function friendlyAuthError(status: number | undefined, fallback: string) {
  if (status === 429) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  return fallback;
}

/** Only allow same-app paths as a post-login destination (no open redirects). */
function safeRedirect(target: string | null): string {
  if (target && target.startsWith('/') && !target.startsWith('//')) return target;
  return '/dashboard';
}

export default function LoginPage() {
  const { session, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get('redirect');
  const redirectTo = safeRedirect(redirectParam);
  // Only steer the post-auth landing when an invite (or similar) asked for it,
  // so the default magic-link/OAuth flow is unchanged.
  const returnUrl = redirectParam
    ? `${window.location.origin}${redirectTo}`
    : window.location.origin;
  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return null;
  if (session) return <Navigate to={redirectTo} replace />;

  async function sendMagicLink() {
    setBusy(true);
    setError(null);
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: returnUrl,
      },
    });
    setBusy(false);
    if (sendError) {
      setError(
        friendlyAuthError(
          sendError.status,
          "We couldn't send the link. Please check the email address and try again.",
        ),
      );
      return;
    }
    setLinkSent(true);
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: returnUrl },
    });
    if (oauthError) {
      setBusy(false);
      setError('Google sign-in is not available right now. Please use your email instead.');
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-3">
        <h1 className="flex items-center">
          <span className="sr-only">Nalvita</span>
          <img src={logoFullLight} alt="" className="h-20 w-auto dark:hidden" />
          <img src={logoFullDark} alt="" className="hidden h-20 w-auto dark:block" />
        </h1>
        <p className="max-w-md text-center text-muted-foreground">
          Your personal health records vault. Documents, medicines, vitals, and history — all in
          one place.
        </p>
      </div>

      <div className="w-full max-w-sm rounded-lg border p-6 shadow-sm">
        {linkSent ? (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">Check your email</h2>
              <p className="text-sm text-muted-foreground">
                We sent a sign-in link to {email}. Open it on this device to finish signing in. The
                link works for the next 10 minutes.
              </p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-between text-sm">
              <button
                type="button"
                className="text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => {
                  setLinkSent(false);
                  setError(null);
                }}
              >
                Use a different email
              </button>
              <button
                type="button"
                className="text-muted-foreground underline-offset-4 hover:underline"
                disabled={busy}
                onClick={() => void sendMagicLink()}
              >
                Send a new link
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">Sign in or create your account</h2>
              <p className="text-sm text-muted-foreground">
                No password needed — we'll email you a secure sign-in link.
              </p>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void sendMagicLink();
              }}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={busy}>
                Email me a sign-in link
              </Button>
            </form>
            <div className="flex items-center gap-3 text-xs uppercase text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              <span>or</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void signInWithGoogle()}
            >
              Continue with Google
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
