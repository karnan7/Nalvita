import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import VitalsPage from './vitals';
import { supabase } from '@/lib/supabase';
import { makeSession, makeVitalRow, stubVitalsList } from '@/test/mocks/supabase';
import { renderWithProviders } from '@/test/render';

// The chart depends on layout measurements jsdom doesn't provide; its logic is
// covered by the vitals lib tests, so stub it out here.
vi.mock('@/components/vitals/vital-chart', () => ({
  VitalChart: () => <div data-testid="vital-chart" />,
}));

beforeEach(() => {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: makeSession() },
    error: null,
  } as never);
});

describe('VitalsPage', () => {
  it('invites the person to log when the selected type has no readings', async () => {
    stubVitalsList([]);
    renderWithProviders(<VitalsPage />, { route: '/vitals' });
    expect(await screen.findByText(/no blood pressure readings yet/i)).toBeInTheDocument();
  });

  it('lists readings for the selected type with a status badge', async () => {
    stubVitalsList([
      makeVitalRow({ id: '00000000-0000-4000-8000-0000000000f1', value_1: 145, value_2: 95 }),
    ]);
    renderWithProviders(<VitalsPage />, { route: '/vitals' });

    const table = await screen.findByRole('table');
    expect(within(table).getByText('145/95')).toBeInTheDocument();
    expect(within(table).getByText('High')).toBeInTheDocument();
  });

  it('switches the reading list when another vital type is chosen', async () => {
    stubVitalsList([
      makeVitalRow({ id: '00000000-0000-4000-8000-0000000000f1', type: 'blood_pressure' }),
      makeVitalRow({
        id: '00000000-0000-4000-8000-0000000000f2',
        type: 'weight',
        value_1: 72,
        value_2: null,
        unit: 'kg',
      }),
    ]);
    const user = userEvent.setup();
    renderWithProviders(<VitalsPage />, { route: '/vitals' });

    // Defaults to blood pressure.
    expect(await screen.findByText('128/84')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Weight' }));

    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.queryByText('128/84')).not.toBeInTheDocument();
  });
});
