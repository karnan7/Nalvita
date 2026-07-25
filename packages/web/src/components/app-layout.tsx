import { HeartPulse } from 'lucide-react';
import { Link, Navigate, Outlet } from 'react-router-dom';

import { FullScreenMessage } from '@/components/require-auth';
import { useAuth } from '@/lib/auth-context';
import { isProfileComplete, useProfile } from '@/lib/profile';

/**
 * Shell for signed-in pages. Sends people who haven't filled in their
 * basic profile to onboarding first.
 */
export function AppLayout() {
  const { session } = useAuth();
  const { data: profile, isPending, isError } = useProfile(session?.user.id);

  if (isPending) return <FullScreenMessage>Loading…</FullScreenMessage>;
  if (isError) return <FullScreenMessage>Something went wrong. Please refresh the page.</FullScreenMessage>;
  if (!isProfileComplete(profile)) return <Navigate to="/onboarding" replace />;

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between p-4">
          <Link to="/" className="flex items-center gap-2">
            <HeartPulse className="size-6 text-destructive" />
            <span className="text-lg font-bold tracking-tight">Nalvita</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link to="/documents" className="text-sm text-muted-foreground hover:text-foreground">
              Documents
            </Link>
            <Link to="/medicines" className="text-sm text-muted-foreground hover:text-foreground">
              Medicines
            </Link>
            <Link to="/settings" className="text-sm text-muted-foreground hover:text-foreground">
              Settings
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl p-4">
        <Outlet />
      </main>
    </div>
  );
}
