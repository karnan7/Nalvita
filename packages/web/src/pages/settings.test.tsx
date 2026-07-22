import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SettingsPage from './settings';
import { supabase } from '@/lib/supabase';
import { makeSession } from '@/test/mocks/supabase';
import { renderWithProviders } from '@/test/render';

beforeEach(() => {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: makeSession() },
    error: null,
  } as never);
});

describe('SettingsPage', () => {
  it('shows the signed-in account', async () => {
    renderWithProviders(<SettingsPage />, { route: '/settings' });
    expect(await screen.findByText(/test\.user@example\.com/)).toBeInTheDocument();
  });

  it('logs out everywhere, not just this device', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, { route: '/settings' });
    await user.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'global' });
  });
});
