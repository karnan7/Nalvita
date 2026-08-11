import type { SupabaseClient } from '@supabase/supabase-js';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

/**
 * Turns a Supabase auth failure into something worth reading.
 *
 * Never surfaces the raw message: those name the provider and occasionally the
 * account state, which tells an attacker whether an address is registered.
 */
export function friendlyAuthError(status: number | undefined, fallback: string): string {
  if (status === 429) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (status === 403 || status === 401) {
    return 'That code is not right, or it has expired. Request a new one.';
  }
  return fallback;
}

/** Sends the six-digit code (and link) to an email address. */
export async function sendEmailCode(
  supabase: SupabaseClient,
  email: string,
): Promise<string | null> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: true },
  });
  if (error) {
    return friendlyAuthError(
      error.status,
      "We couldn't send the code. Please check the email address and try again.",
    );
  }
  return null;
}

/**
 * Exchanges the code for a session.
 *
 * `type: 'email'` covers both a first-time signup and a returning sign-in —
 * Supabase decides which based on whether the account exists, so the app does
 * not have to ask people whether they have signed up before.
 */
export async function verifyEmailCode(
  supabase: SupabaseClient,
  email: string,
  code: string,
): Promise<string | null> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: 'email',
  });
  if (error) {
    return friendlyAuthError(error.status, 'That code did not work. Request a new one.');
  }
  return null;
}

/**
 * Google sign-in.
 *
 * There is no redirect to follow on a phone, so the OAuth dance runs in a
 * system browser sheet and comes back to the app's own scheme. `skipBrowser
 * Redirect` hands us the URL to open rather than trying to navigate a `window`
 * that does not exist.
 */
export async function signInWithGoogle(supabase: SupabaseClient): Promise<string | null> {
  const redirectTo = AuthSession.makeRedirectUri({ scheme: 'nalvita', path: 'auth/callback' });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) {
    return 'Google sign-in is not available right now. Please use your email instead.';
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    // Dismissed or cancelled — not an error worth shouting about.
    return null;
  }

  return exchangeCallback(supabase, result.url);
}

/** Completes PKCE by trading the returned `code` for a session. */
async function exchangeCallback(supabase: SupabaseClient, url: string): Promise<string | null> {
  const code = new URL(url).searchParams.get('code');
  if (!code) {
    return 'Google sign-in did not complete. Please try again.';
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return 'Google sign-in did not complete. Please try again.';
  }
  return null;
}
