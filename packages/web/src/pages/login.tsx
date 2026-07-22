import { HeartPulse } from 'lucide-react';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

function friendlyAuthError(status: number | undefined, fallback: string) {
  if (status === 429) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  return fallback;
}

export default function LoginPage() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return null;
  if (session) return <Navigate to="/" replace />;

  async function sendCode() {
    setBusy(true);
    setError(null);
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (sendError) {
      setError(
        friendlyAuthError(
          sendError.status,
          "We couldn't send the code. Please check the email address and try again.",
        ),
      );
      return;
    }
    setCode('');
    setCodeSent(true);
  }

  async function verifyCode() {
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });
    setBusy(false);
    if (verifyError) {
      setError(
        friendlyAuthError(
          verifyError.status,
          "That code didn't work. Please check the latest email and try again.",
        ),
      );
    }
    // On success the auth listener picks up the session and we redirect above.
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (oauthError) {
      setBusy(false);
      setError('Google sign-in is not available right now. Please use your email instead.');
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-3">
          <HeartPulse className="size-10 text-destructive" />
          <h1 className="text-4xl font-bold tracking-tight">Nalvita</h1>
        </div>
        <p className="max-w-md text-center text-muted-foreground">
          Your personal health records vault. Documents, medicines, vitals, and history — all in
          one place.
        </p>
      </div>

      <div className="w-full max-w-sm rounded-lg border p-6 shadow-sm">
        {codeSent ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void verifyCode();
            }}
            className="flex flex-col gap-4"
          >
            <div>
              <h2 className="text-lg font-semibold">Check your email</h2>
              <p className="text-sm text-muted-foreground">
                We sent a 6-digit code to {email}. Enter it below to sign in.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="code">Sign-in code</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={busy}>
              Sign in
            </Button>
            <div className="flex justify-between text-sm">
              <button
                type="button"
                className="text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => {
                  setCodeSent(false);
                  setError(null);
                }}
              >
                Use a different email
              </button>
              <button
                type="button"
                className="text-muted-foreground underline-offset-4 hover:underline"
                disabled={busy}
                onClick={() => void sendCode()}
              >
                Send a new code
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">Sign in or create your account</h2>
              <p className="text-sm text-muted-foreground">
                No password needed — we'll email you a one-time code.
              </p>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void sendCode();
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
                Email me a code
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
