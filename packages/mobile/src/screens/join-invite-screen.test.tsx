import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { JoinInviteScreen } from '@/screens/join-invite-screen';
import { makeHarness, renderWithProviders } from '@/test/render';

const mockReplace = jest.fn();
let mockParams: { token?: string } = { token: 'link-secret' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}));

function preview(overrides: Record<string, unknown> = {}) {
  return {
    owner_id: '00000000-0000-4000-8000-000000000002',
    owner_name: 'Arjun',
    requested_role: 'caregiver',
    requested_categories: ['medicines', 'vitals'],
    expires_at: '2026-08-20T08:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { token: 'link-secret' };
});

describe('opening an invite link', () => {
  it('says so plainly when the link carries no code', () => {
    mockParams = {};

    renderWithProviders(<JoinInviteScreen />);

    expect(screen.getByText(/missing its invite code/i)).toBeOnTheScreen();
  });

  it('previews the offer without joining anything', async () => {
    const harness = makeHarness();
    harness.rpc.mockImplementation(async () => ({ data: [preview()], error: null }));

    renderWithProviders(<JoinInviteScreen />, harness);

    await waitFor(() =>
      expect(screen.getByText(/Arjun wants to share their health records/i)).toBeOnTheScreen(),
    );

    // Opening a link must never be what joins a circle.
    expect(harness.rpc).toHaveBeenCalledWith('preview_circle_invite', {
      p_secret: 'link-secret',
    });
    expect(harness.rpc).not.toHaveBeenCalledWith('accept_circle_invite', expect.anything());
  });

  it('spells out what access is being asked for', async () => {
    const harness = makeHarness();
    harness.rpc.mockImplementation(async () => ({ data: [preview()], error: null }));

    renderWithProviders(<JoinInviteScreen />, harness);

    await waitFor(() => expect(screen.getByText(/can view and add/i)).toBeOnTheScreen());
    expect(screen.getByText(/Medicines and Vitals/)).toBeOnTheScreen();
  });

  it('has a respectful name for an owner who never set one', async () => {
    const harness = makeHarness();
    harness.rpc.mockImplementation(async () => ({
      data: [preview({ owner_name: '  ' })],
      error: null,
    }));

    renderWithProviders(<JoinInviteScreen />, harness);

    await waitFor(() =>
      expect(screen.getByText(/A family member wants to share/i)).toBeOnTheScreen(),
    );
  });

  it('explains a spent or expired invite instead of failing silently', async () => {
    const harness = makeHarness();
    harness.rpc.mockImplementation(async () => ({ data: [], error: null }));

    renderWithProviders(<JoinInviteScreen />, harness);

    await waitFor(() =>
      expect(screen.getByText(/expired or has already been used/i)).toBeOnTheScreen(),
    );
  });
});

describe('answering an invite', () => {
  it('joins only once the person accepts, then sends them home', async () => {
    const harness = makeHarness();
    harness.rpc.mockImplementation(async (fn: string) =>
      fn === 'preview_circle_invite'
        ? { data: [preview()], error: null }
        : { data: null, error: null },
    );

    renderWithProviders(<JoinInviteScreen />, harness);

    await waitFor(() => expect(screen.getByRole('button', { name: /Accept and join/ })).toBeOnTheScreen());
    fireEvent.press(screen.getByRole('button', { name: /Accept and join/ }));

    await waitFor(() =>
      expect(harness.rpc).toHaveBeenCalledWith('accept_circle_invite', {
        p_secret: 'link-secret',
      }),
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('lets them walk away without joining', async () => {
    const harness = makeHarness();
    harness.rpc.mockImplementation(async () => ({ data: [preview()], error: null }));

    renderWithProviders(<JoinInviteScreen />, harness);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Not now' })).toBeOnTheScreen());
    fireEvent.press(screen.getByRole('button', { name: 'Not now' }));

    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(harness.rpc).not.toHaveBeenCalledWith('accept_circle_invite', expect.anything());
  });

  it('reports a refused join rather than pretending it worked', async () => {
    const harness = makeHarness();
    harness.rpc.mockImplementation(async (fn: string) =>
      fn === 'preview_circle_invite'
        ? { data: [preview()], error: null }
        : { data: null, error: { message: 'expired' } },
    );

    renderWithProviders(<JoinInviteScreen />, harness);

    await waitFor(() => expect(screen.getByRole('button', { name: /Accept and join/ })).toBeOnTheScreen());
    fireEvent.press(screen.getByRole('button', { name: /Accept and join/ }));

    await waitFor(() =>
      expect(screen.getByText(/could not join that circle/i)).toBeOnTheScreen(),
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
