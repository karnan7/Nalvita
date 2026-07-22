import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import LoginPage from './login';
import { supabase } from '@/lib/supabase';
import { renderWithProviders } from '@/test/render';

async function requestCode(email = 'test.user@example.com') {
  const user = userEvent.setup();
  renderWithProviders(<LoginPage />, { route: '/login' });
  await user.type(await screen.findByLabelText('Email address'), email);
  await user.click(screen.getByRole('button', { name: 'Email me a code' }));
  return user;
}

describe('LoginPage', () => {
  it('emails a one-time code and moves to the code step', async () => {
    await requestCode();
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'test.user@example.com',
      options: { shouldCreateUser: true },
    });
    expect(await screen.findByLabelText('Sign-in code')).toBeInTheDocument();
  });

  it('verifies the entered code as an email OTP', async () => {
    const user = await requestCode();
    await user.type(await screen.findByLabelText('Sign-in code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      email: 'test.user@example.com',
      token: '123456',
      type: 'email',
    });
  });

  it('shows a friendly message for a wrong code', async () => {
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValueOnce({
      data: {},
      error: { status: 403, message: 'Token has expired or is invalid' },
    } as never);
    const user = await requestCode();
    await user.type(await screen.findByLabelText('Sign-in code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/that code didn't work/i)).toBeInTheDocument();
  });

  it('tells the person to wait when attempts are rate limited', async () => {
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValueOnce({
      data: {},
      error: { status: 429, message: 'Rate limit exceeded' },
    } as never);
    const user = await requestCode();
    await user.type(await screen.findByLabelText('Sign-in code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
  });

  it('starts Google sign-in with one tap', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: '/login' });
    await user.click(await screen.findByRole('button', { name: 'Continue with Google' }));
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  });
});
