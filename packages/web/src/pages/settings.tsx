import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
  const { session } = useAuth();
  const [error, setError] = useState<string | null>(null);

  async function logOut() {
    setError(null);
    // Global scope ends the session on every device, not just this one.
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
    if (signOutError) {
      setError("We couldn't log you out. Please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <section className="flex max-w-sm flex-col gap-3 rounded-lg border p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Your account</h2>
        <p className="text-sm text-muted-foreground">Signed in as {session?.user.email}</p>
        <p className="text-sm text-muted-foreground">
          Logging out ends your session on every device where you're signed in.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button variant="outline" onClick={() => void logOut()}>
          Log out
        </Button>
      </section>
    </div>
  );
}
