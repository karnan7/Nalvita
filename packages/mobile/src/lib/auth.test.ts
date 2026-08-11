import type { SupabaseClient } from '@supabase/supabase-js';

import { friendlyAuthError, sendEmailCode, verifyEmailCode } from '@/lib/auth';

function clientWith(auth: Partial<SupabaseClient['auth']>): SupabaseClient {
  return { auth } as unknown as SupabaseClient;
}

describe('friendlyAuthError', () => {
  it('names the wait when the person is being rate limited', () => {
    expect(friendlyAuthError(429, 'fallback')).toMatch(/wait a minute/i);
  });

  it.each([401, 403])('treats %d as a wrong or expired code', (status) => {
    expect(friendlyAuthError(status, 'fallback')).toMatch(/not right, or it has expired/i);
  });

  it('falls back for anything it does not recognise', () => {
    expect(friendlyAuthError(500, 'fallback')).toBe('fallback');
    expect(friendlyAuthError(undefined, 'fallback')).toBe('fallback');
  });

  /**
   * Auth errors must not confirm whether an address has an account — that turns
   * the login form into an account-enumeration oracle.
   */
  it('never repeats the provider’s own wording', () => {
    const raw = 'User already registered';
    expect(friendlyAuthError(400, 'Something went wrong.')).not.toContain(raw);
  });
});

describe('sendEmailCode', () => {
  it('creates the account if there is not one yet, and trims the address', async () => {
    const signInWithOtp = jest.fn(async () => ({ data: {}, error: null }));
    const supabase = clientWith({ signInWithOtp } as never);

    const failure = await sendEmailCode(supabase, '  amma@example.com  ');

    expect(failure).toBeNull();
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'amma@example.com',
      options: { shouldCreateUser: true },
    });
  });

  it('reports a friendly failure rather than the raw error', async () => {
    const signInWithOtp = jest.fn(async () => ({
      data: {},
      error: { status: 429, message: 'over_email_send_rate_limit' },
    }));
    const supabase = clientWith({ signInWithOtp } as never);

    const failure = await sendEmailCode(supabase, 'amma@example.com');

    expect(failure).toMatch(/wait a minute/i);
    expect(failure).not.toMatch(/rate_limit/);
  });
});

describe('verifyEmailCode', () => {
  it("exchanges the code for a session using the 'email' type", async () => {
    const verifyOtp = jest.fn(async () => ({ data: {}, error: null }));
    const supabase = clientWith({ verifyOtp } as never);

    const failure = await verifyEmailCode(supabase, 'amma@example.com', ' 123456 ');

    expect(failure).toBeNull();
    // One call covers both first signup and a returning sign-in, so the app
    // never has to ask which one this is.
    expect(verifyOtp).toHaveBeenCalledWith({
      email: 'amma@example.com',
      token: '123456',
      type: 'email',
    });
  });

  it('asks for a new code when the one given is refused', async () => {
    const verifyOtp = jest.fn(async () => ({ data: {}, error: { status: 403 } }));
    const supabase = clientWith({ verifyOtp } as never);

    expect(await verifyEmailCode(supabase, 'amma@example.com', '000000')).toMatch(/expired/i);
  });
});
