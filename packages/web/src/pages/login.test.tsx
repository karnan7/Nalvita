import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import LoginPage from './login';
import { supabase } from '@/lib/supabase';
import { renderWithProviders } from '@/test/render';

async function requestLink(email = 'test.user@example.com') {
  const user = userEvent.setup();
  renderWithProviders(<LoginPage />, { route: '/login' });
  await user.type(await screen.findByLabelText('Email address'), email);
  await user.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
  return user;
}

describe('LoginPage', () => {
  it('emails a sign-in link and moves to the check-your-email step', async () => {
    await requestLink();
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'test.user@example.com',
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    });
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
    expect(screen.getByText(/we sent a sign-in link to test.user@example.com/i)).toBeInTheDocument();
  });

  it('shows a friendly message when the link cannot be sent', async () => {
    vi.mocked(supabase.auth.signInWithOtp).mockResolvedValueOnce({
      data: {},
      error: { status: 400, message: 'Invalid email' },
    } as never);
    await requestLink();
    expect(await screen.findByText(/we couldn't send the link/i)).toBeInTheDocument();
  });

  it('tells the person to wait when requests are rate limited', async () => {
    vi.mocked(supabase.auth.signInWithOtp).mockResolvedValueOnce({
      data: {},
      error: { status: 429, message: 'Rate limit exceeded' },
    } as never);
    await requestLink();
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

  it('returns the person to a safe redirect target after sign-in', async () => {
    const user = userEvent.setup();
    const redirect = '/family/join?token=tok123';
    renderWithProviders(<LoginPage />, { route: `/login?redirect=${encodeURIComponent(redirect)}` });
    await user.type(await screen.findByLabelText('Email address'), 'test.user@example.com');
    await user.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));

    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'test.user@example.com',
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}${redirect}`,
      },
    });
  });

  it('ignores an off-site redirect target', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: '/login?redirect=https://evil.example.com' });
    await user.click(await screen.findByRole('button', { name: 'Continue with Google' }));
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  });
});
