import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DashboardPage from './dashboard';
import { supabase } from '@/lib/supabase';
import {
  makeAllergyRow,
  makeDocumentRow,
  makeMedicineRow,
  makeProfileRow,
  makeSession,
  makeVitalRow,
  stubTables,
} from '@/test/mocks/supabase';
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

    expect(
      await screen.findByText(/Penicillin \(Severe\), Pollen \(Moderate\)/),
    ).toBeInTheDocument();
  });

  it('shows no banner when there are no allergies', async () => {
    stubTables({ profiles: makeProfileRow({ full_name: 'Asha Menon' }), allergies: [] });
    renderWithProviders(<DashboardPage />, { route: '/' });

    expect(await screen.findByText(/Hello, Asha Menon/)).toBeInTheDocument();
    expect(screen.queryByText(/allergies/i)).not.toBeInTheDocument();
  });
});

describe('DashboardPage summary cards', () => {
  it('summarizes documents, medicines and vitals across the cards', async () => {
    stubTables({
      profiles: makeProfileRow({ full_name: 'Asha Menon' }),
      documents: [makeDocumentRow({ title: 'Blood test report' })],
      medicines: [makeMedicineRow({ name: 'Metformin', status: 'active' })],
      vitals: [makeVitalRow({ type: 'blood_pressure', value_1: 128, value_2: 84 })],
    });
    renderWithProviders(<DashboardPage />, { route: '/' });

    expect((await screen.findAllByText('Blood test report')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Metformin/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('128/84 mmHg').length).toBeGreaterThan(0);
    // Structural cards are always present.
    expect(screen.getByText('Active medicines')).toBeInTheDocument();
    expect(screen.getByText('Last checkup')).toBeInTheDocument();
  });

  it('shows a friendly prompt in each card when there is no data', async () => {
    stubTables({ profiles: makeProfileRow({ full_name: 'Asha Menon' }) });
    renderWithProviders(<DashboardPage />, { route: '/' });

    expect(await screen.findByText(/upload your first document/i)).toBeInTheDocument();
    expect(screen.getByText(/add a medicine/i)).toBeInTheDocument();
    expect(screen.getByText(/log a reading/i)).toBeInTheDocument();
    expect(screen.getByText(/your health events will appear here/i)).toBeInTheDocument();
  });
});
