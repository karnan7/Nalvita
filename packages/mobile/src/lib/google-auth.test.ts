import type { SupabaseClient } from '@supabase/supabase-js';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { signInWithGoogle } from '@/lib/auth';

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'nalvita://auth/callback'),
}));
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}));

const signInWithOAuth = jest.fn();
const exchangeCodeForSession = jest.fn();

function client(): SupabaseClient {
  return { auth: { signInWithOAuth, exchangeCodeForSession } } as unknown as SupabaseClient;
}

beforeEach(() => {
  jest.clearAllMocks();
  signInWithOAuth.mockResolvedValue({ data: { url: 'https://accounts.google/auth' }, error: null });
  exchangeCodeForSession.mockResolvedValue({ error: null });
  (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
    type: 'success',
    url: 'nalvita://auth/callback?code=auth-code-123',
  });
});

describe('signInWithGoogle', () => {
  /**
   * There is no `window` to redirect on a phone: Supabase must hand back the
   * URL so it can be opened in a system browser sheet that returns to the app.
   */
  it('asks Supabase for the URL rather than letting it navigate', async () => {
    await signInWithGoogle(client());

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'nalvita://auth/callback', skipBrowserRedirect: true },
    });
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      'https://accounts.google/auth',
      'nalvita://auth/callback',
    );
  });

  it('completes PKCE by trading the returned code for a session', async () => {
    const failure = await signInWithGoogle(client());

    expect(exchangeCodeForSession).toHaveBeenCalledWith('auth-code-123');
    expect(failure).toBeNull();
  });

  it('redirects back to the app’s own scheme, not a web origin', () => {
    void signInWithGoogle(client());

    expect(AuthSession.makeRedirectUri).toHaveBeenCalledWith({
      scheme: 'nalvita',
      path: 'auth/callback',
    });
  });

  /** Backing out is a choice, not a failure — it must not raise an error. */
  it('says nothing when the person dismisses the sheet', async () => {
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({ type: 'dismiss' });

    expect(await signInWithGoogle(client())).toBeNull();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('points people at email when Google is unavailable', async () => {
    signInWithOAuth.mockResolvedValue({ data: { url: null }, error: { message: 'disabled' } });

    expect(await signInWithGoogle(client())).toMatch(/use your email instead/i);
  });

  it('reports a callback that came back without a code', async () => {
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'success',
      url: 'nalvita://auth/callback?error=access_denied',
    });

    expect(await signInWithGoogle(client())).toMatch(/did not complete/i);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('reports a refused exchange rather than appearing signed in', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: 'bad verifier' } });

    expect(await signInWithGoogle(client())).toMatch(/did not complete/i);
  });
});
