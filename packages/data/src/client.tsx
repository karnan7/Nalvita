import type { SupabaseClient } from '@supabase/supabase-js';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

/**
 * Everything this package needs from the platform underneath it.
 *
 * The hooks here are shared by the web app and the React Native app, so nothing
 * in them may reach for `window`, `localStorage`, or a Vite env var. The few
 * places that genuinely need the platform take it from here instead.
 */
export interface NalvitaPlatform {
  /**
   * The Supabase client, created by the host app so each platform can supply
   * its own storage: the browser's default in web, an `expo-secure-store`
   * adapter on mobile. Row-level security is still the whole authorization
   * layer — this must never be a service-role client.
   */
  client: SupabaseClient;
  /**
   * Origin used to build invite and handover links, e.g.
   * `https://nalvita.app`. Web passes `window.location.origin`; mobile passes
   * the deployed web origin, because a claim link has to open somewhere a
   * person without the app installed can still reach.
   */
  appBaseUrl: string;
  /**
   * Opens an external URL — a signed document URL, in practice. Web opens a
   * tab; mobile hands off to the system viewer. Signed URLs are short-lived by
   * design, so whatever opens them must do it immediately.
   */
  openUrl: (url: string) => void;
}

const PlatformContext = createContext<NalvitaPlatform | null>(null);

/**
 * Supplies the Supabase client and the handful of platform capabilities the
 * data hooks need. Wrap the app in this above `QueryClientProvider`.
 */
export function NalvitaDataProvider({
  children,
  client,
  appBaseUrl,
  openUrl,
}: Readonly<NalvitaPlatform & { children: ReactNode }>) {
  const value = useMemo(
    () => ({ client, appBaseUrl, openUrl }),
    [client, appBaseUrl, openUrl],
  );

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

/**
 * The platform this app is running on.
 *
 * Throws rather than returning a half-built default: a missing provider means
 * the app is misconfigured, and silently falling back would send health queries
 * nowhere. This replaces the import-time throw the web client used to do on
 * absent env vars — same loudness, but at setup rather than at import, which is
 * what lets tests inject a stub.
 */
export function usePlatform(): NalvitaPlatform {
  const platform = useContext(PlatformContext);
  if (platform === null) {
    throw new Error(
      'Nalvita data hooks used outside NalvitaDataProvider. Wrap the app in <NalvitaDataProvider client={…} appBaseUrl={…} openUrl={…}>.',
    );
  }
  return platform;
}

/** The Supabase client for the current app — the common case of `usePlatform`. */
export function useSupabase(): SupabaseClient {
  return usePlatform().client;
}
