import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { DocumentsScreen } from '@/screens/documents-screen';
import { HomeScreen } from '@/screens/home-screen';
import { MedicinesScreen } from '@/screens/medicines-screen';
import { ProfileScreen } from '@/screens/profile-screen';
import { VitalsScreen } from '@/screens/vitals-screen';
import { chain, makeHarness, makeProfileRow, renderWithProviders } from '@/test/render';

const SESSION = {
  user: { id: '00000000-0000-4000-8000-000000000001', email: 'amma@example.com' },
};

jest.mock('@nalvita/data', () => {
  const actual = jest.requireActual('@nalvita/data');
  return { ...actual, useAuth: () => ({ session: SESSION, loading: false }) };
});

describe('HomeScreen', () => {
  it('greets the person by name once their profile loads', async () => {
    const harness = makeHarness();
    harness.from.mockImplementation(() =>
      chain({ data: makeProfileRow({ full_name: 'Amma' }), error: null }),
    );

    renderWithProviders(<HomeScreen />, harness);

    await waitFor(() => expect(screen.getByText('Hello, Amma')).toBeOnTheScreen());
  });

  it('falls back to a plain greeting when no name is set', async () => {
    const harness = makeHarness();
    harness.from.mockImplementation(() => chain({ data: makeProfileRow(), error: null }));

    renderWithProviders(<HomeScreen />, harness);

    await waitFor(() => expect(screen.getByText('Hello')).toBeOnTheScreen());
  });

  it('says it is loading before the profile arrives', () => {
    const harness = makeHarness();
    // A read that never settles, so "loading" is a stable state to assert on
    // rather than a race the assertion has to win.
    harness.from.mockImplementation(() => {
      const pending = new Promise(() => undefined) as Promise<never> & Record<string, unknown>;
      for (const method of ['select', 'eq', 'order', 'limit', 'is']) pending[method] = () => pending;
      pending.single = () => new Promise(() => undefined);
      pending.maybeSingle = () => new Promise(() => undefined);
      return pending;
    });

    renderWithProviders(<HomeScreen />, harness);

    expect(screen.getByText(/Loading your profile/i)).toBeOnTheScreen();
  });

  it('offers a way forward rather than a blank screen when the read fails', async () => {
    const harness = makeHarness();
    harness.from.mockImplementation(() => chain({ data: null, error: { message: 'denied' } }));

    renderWithProviders(<HomeScreen />, harness);

    await waitFor(() =>
      expect(screen.getByText(/could not load your profile/i)).toBeOnTheScreen(),
    );
  });
});

describe('ProfileScreen', () => {
  it('shows the name and the account signed in', async () => {
    const harness = makeHarness();
    harness.from.mockImplementation(() =>
      chain({ data: makeProfileRow({ full_name: 'Amma' }), error: null }),
    );

    renderWithProviders(<ProfileScreen />, harness);

    await waitFor(() => expect(screen.getByText('Amma')).toBeOnTheScreen());
    expect(screen.getByText('amma@example.com')).toBeOnTheScreen();
  });

  it('says so plainly when a name has never been set', async () => {
    renderWithProviders(<ProfileScreen />);

    await waitFor(() => expect(screen.getByText('Not set')).toBeOnTheScreen());
  });

  it('signs out through the injected client', async () => {
    const { harness } = renderWithProviders(<ProfileScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(harness.signOut).toHaveBeenCalled());
  });
});

/**
 * The three screens KAR-57 fills in. They still have to render and say
 * something truthful rather than showing an empty page.
 */
describe.each([
  ['Documents', DocumentsScreen],
  ['Medicines', MedicinesScreen],
  ['Vitals', VitalsScreen],
])('%s placeholder', (title, Component) => {
  it('renders its heading and says more is coming', () => {
    renderWithProviders(<Component />);

    expect(screen.getByText(title)).toBeOnTheScreen();
    expect(screen.getByText(/coming in the next update/i)).toBeOnTheScreen();
  });
});
