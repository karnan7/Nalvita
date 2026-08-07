import { BLOOD_GROUPS } from '@nalvita/core';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import OnboardingPage from './onboarding';
import { supabase } from '@/lib/supabase';
import { makeProfileRow, makeSession, rowBuilder } from '@/test/mocks/supabase';
import { renderWithProviders } from '@/test/render';

beforeEach(() => {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: makeSession() },
    error: null,
  } as never);
});

describe('OnboardingPage', () => {
  it('offers every blood group and gender option from core', async () => {
    renderWithProviders(<OnboardingPage />, { route: '/onboarding' });
    for (const group of BLOOD_GROUPS) {
      expect(await screen.findByRole('option', { name: group })).toBeInTheDocument();
    }
    expect(screen.getByRole('option', { name: 'Prefer not to say' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: "I'm not sure" })).toBeInTheDocument();
  });

  it('saves the details to the own profiles row', async () => {
    const single = vi.fn(async () => ({
      data: makeProfileRow({
        full_name: 'Test Person',
        date_of_birth: '1960-01-05',
        gender: 'female',
        blood_group: 'O+',
      }),
      error: null,
    }));
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    // The same table serves both the profile lookup and the save.
    vi.mocked(supabase.from).mockReturnValue({
      ...rowBuilder(makeProfileRow()),
      update,
    } as never);

    const user = userEvent.setup();
    renderWithProviders(<OnboardingPage />, { route: '/onboarding' });
    await user.type(await screen.findByLabelText('Full name'), 'Test Person');
    await user.type(screen.getByLabelText('Date of birth'), '1960-01-05');
    await user.selectOptions(screen.getByLabelText('Gender'), 'female');
    await user.selectOptions(screen.getByLabelText('Blood group'), 'O+');
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        full_name: 'Test Person',
        date_of_birth: '1960-01-05',
        gender: 'female',
        blood_group: 'O+',
      }),
    );
    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(eq).toHaveBeenCalledWith('id', '00000000-0000-4000-8000-0000000000aa');
  });
});
