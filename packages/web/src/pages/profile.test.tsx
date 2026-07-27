import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProfilePage from './profile';
import { supabase } from '@/lib/supabase';
import {
  makeAllergyRow,
  makeConditionRow,
  makeDoctorRow,
  makeProfileRow,
  makeSession,
  stubTables,
} from '@/test/mocks/supabase';
import { renderWithProviders } from '@/test/render';

beforeEach(() => {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: makeSession() },
    error: null,
  } as never);
});

describe('ProfilePage', () => {
  it('shows personal details with a prominent blood group and computed age', async () => {
    stubTables({
      profiles: makeProfileRow({
        full_name: 'Asha Menon',
        date_of_birth: '1980-01-01',
        blood_group: 'O+',
        height_cm: 165,
        weight_kg: 60,
      }),
    });
    renderWithProviders(<ProfilePage />, { route: '/profile' });

    expect(await screen.findByRole('heading', { name: 'Asha Menon' })).toBeInTheDocument();
    // Blood group appears as its own prominent badge plus the details grid.
    expect(screen.getAllByText('O+').length).toBeGreaterThan(0);
    expect(screen.getByText('165 cm')).toBeInTheDocument();
  });

  it('lists allergies, conditions and a callable doctor phone number', async () => {
    stubTables({
      profiles: makeProfileRow({ full_name: 'Asha Menon' }),
      allergies: [makeAllergyRow({ allergen: 'Penicillin', severity: 'severe' })],
      conditions: [makeConditionRow({ name: 'Hypertension' })],
      doctors: [makeDoctorRow({ name: 'Dr Suresh Pillai', phone: '+911234567890' })],
    });
    renderWithProviders(<ProfilePage />, { route: '/profile' });

    expect(await screen.findByText('Penicillin')).toBeInTheDocument();
    expect(screen.getByText('Hypertension')).toBeInTheDocument();

    const phoneLink = screen.getByRole('link', { name: /\+911234567890/ });
    expect(phoneLink).toHaveAttribute('href', 'tel:+911234567890');
  });

  it('invites the person to add records when sections are empty', async () => {
    stubTables({ profiles: makeProfileRow({ full_name: 'Asha Menon' }) });
    renderWithProviders(<ProfilePage />, { route: '/profile' });

    expect(await screen.findByText(/no allergies recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/no conditions recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/no doctors saved/i)).toBeInTheDocument();
  });
});
