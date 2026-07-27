import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DashboardPage from './dashboard';
import { supabase } from '@/lib/supabase';
import { makeAllergyRow, makeProfileRow, makeSession, stubTables } from '@/test/mocks/supabase';
import { renderWithProviders } from '@/test/render';

beforeEach(() => {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: makeSession() },
    error: null,
  } as never);
});

describe('DashboardPage allergy banner', () => {
  it('surfaces recorded allergies in an alert banner, most serious first', async () => {
    stubTables({
      profiles: makeProfileRow({ full_name: 'Asha Menon' }),
      allergies: [
        makeAllergyRow({ id: '00000000-0000-4000-8000-0000000000b1', allergen: 'Pollen', severity: 'moderate' }),
        makeAllergyRow({ id: '00000000-0000-4000-8000-0000000000b2', allergen: 'Penicillin', severity: 'severe' }),
      ],
    });
    renderWithProviders(<DashboardPage />, { route: '/' });

    const banner = await screen.findByText(/Penicillin \(Severe\), Pollen \(Moderate\)/);
    expect(banner).toBeInTheDocument();
  });

  it('shows no banner when there are no allergies', async () => {
    stubTables({ profiles: makeProfileRow({ full_name: 'Asha Menon' }), allergies: [] });
    renderWithProviders(<DashboardPage />, { route: '/' });

    expect(await screen.findByText(/Hello, Asha Menon/)).toBeInTheDocument();
    expect(screen.queryByText(/allergies/i)).not.toBeInTheDocument();
  });
});
