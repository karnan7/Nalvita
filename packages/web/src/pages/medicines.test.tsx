import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MedicinesPage from './medicines';
import { supabase } from '@/lib/supabase';
import { makeMedicineRow, makeSession, stubMedicinesList } from '@/test/mocks/supabase';
import { renderWithProviders } from '@/test/render';

beforeEach(() => {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: makeSession() },
    error: null,
  } as never);
});

describe('MedicinesPage', () => {
  it('invites the person to add when they have no active medicines', async () => {
    stubMedicinesList([]);
    renderWithProviders(<MedicinesPage />, { route: '/medicines' });
    expect(await screen.findByText(/no active medicines/i)).toBeInTheDocument();
  });

  it('separates active and past medicines across the two tabs', async () => {
    stubMedicinesList([
      makeMedicineRow({
        id: '00000000-0000-4000-8000-0000000000e1',
        name: 'Metformin',
        status: 'active',
      }),
      makeMedicineRow({
        id: '00000000-0000-4000-8000-0000000000e2',
        name: 'Amoxicillin',
        status: 'stopped',
        end_date: '2026-06-10',
      }),
    ]);
    const user = userEvent.setup();
    renderWithProviders(<MedicinesPage />, { route: '/medicines' });

    // Active tab shows only the active medicine.
    expect(await screen.findByText('Metformin')).toBeInTheDocument();
    expect(screen.queryByText('Amoxicillin')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /past/i }));

    expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
    expect(screen.queryByText('Metformin')).not.toBeInTheDocument();
  });

  it('shows a refill-due badge on a medicine whose refill date is near', async () => {
    const soon = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    stubMedicinesList([
      makeMedicineRow({ name: 'Metformin', status: 'active', refill_date: soon }),
    ]);
    renderWithProviders(<MedicinesPage />, { route: '/medicines' });

    expect(await screen.findByText('Metformin')).toBeInTheDocument();
    expect(screen.getByText(/refill due/i)).toBeInTheDocument();
  });
});
