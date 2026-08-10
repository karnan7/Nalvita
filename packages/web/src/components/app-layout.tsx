import { Navigate, Outlet } from 'react-router-dom';

import { FullScreenMessage } from '@/components/require-auth';
import { PageShell } from '@/components/ui-nalvita';
import { isProfileComplete, useAuth, useProfile } from '@nalvita/data';

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
    <PageShell>
      <Outlet />
    </PageShell>
  );
}
