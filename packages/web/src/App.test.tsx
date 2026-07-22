import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import App from './App';
import { supabase } from '@/lib/supabase';
import { makeProfileRow, makeSession, stubProfileSelect } from '@/test/mocks/supabase';
import { renderWithProviders } from '@/test/render';

function signIn() {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: makeSession() },
    error: null,
  } as never);
}

describe('App routing', () => {
  it('shows the login screen when signed out', async () => {
    renderWithProviders(<App />);
    expect(await screen.findByRole('heading', { name: 'Nalvita' })).toBeInTheDocument();
    expect(screen.getByText('Sign in or create your account')).toBeInTheDocument();
  });

  it('sends a fresh signup to onboarding first', async () => {
    signIn();
    stubProfileSelect(makeProfileRow());
    renderWithProviders(<App />);
    expect(await screen.findByText('Tell us about yourself')).toBeInTheDocument();
  });

  it('shows the dashboard once the profile is complete', async () => {
    signIn();
    stubProfileSelect(makeProfileRow({ full_name: 'Test Person' }));
    renderWithProviders(<App />);
    expect(await screen.findByText('Hello, Test Person')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
  });
});
