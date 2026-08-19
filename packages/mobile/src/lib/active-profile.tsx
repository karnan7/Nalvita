import { ActiveProfileContext, useAuth, useProfile } from '@nalvita/data';
import { useMemo, type ReactNode } from 'react';

/**
 * Tells the data layer whose records to load.
 *
 * Every hook in `@nalvita/data` reads `profileId` from this context and stays
 * disabled while it is empty, so without a provider the app renders correct,
 * permanently empty screens — which is exactly what it did before this existed.
 * The context's default is a not-ready placeholder, not a fallback to the
 * session, and deliberately so: silently guessing whose records to show is the
 * one failure mode a health app cannot have.
 *
 * Records belong to profiles rather than accounts, so the profile row is what
 * supplies the id — the session only knows the account.
 *
 * Self only. Viewing a family member's records is the web app's
 * `ActiveProfileProvider`, and is left to the mobile Health Circle work; the
 * write guard it exists to enforce has nothing to guard while `viewing` is
 * always null.
 */
export function ActiveProfileProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { session } = useAuth();
  const { data: profile } = useProfile(session?.user.id);

  const value = useMemo(
    () => ({
      profileId: profile?.id ?? '',
      isSelf: true,
      viewing: null,
      setViewing: () => undefined,
      guardWrite: (write: () => void) => write(),
    }),
    [profile?.id],
  );

  return <ActiveProfileContext.Provider value={value}>{children}</ActiveProfileContext.Provider>;
}
