import { act, render, screen } from '@testing-library/react-native';
import * as Network from 'expo-network';
import { Text } from 'react-native';

import { LockGate } from '@/components/lock-screen';
import { OfflineBanner } from '@/components/offline-banner';
import type { LockState } from '@/lib/lock';

/** Drives LockGate without standing up the whole provider. */
const mockLockState: LockState = {
  locked: false,
  obscured: false,
  enabled: true,
  available: true,
  isLoading: false,
  setEnabled: jest.fn(),
  unlock: jest.fn(async () => true),
};

jest.mock('@/lib/lock', () => ({
  ...jest.requireActual('@/lib/lock'),
  useLock: () => mockLockState,
}));

function reset(overrides: Partial<LockState> = {}) {
  Object.assign(mockLockState, {
    locked: false,
    obscured: false,
    enabled: true,
    available: true,
    isLoading: false,
    ...overrides,
  });
}

const SECRET = 'Penicillin';

beforeEach(() => {
  reset();
  jest.mocked(Network.useNetworkState).mockReturnValue({
    isConnected: true,
    isInternetReachable: true,
  } as never);
});

describe('the lock gate', () => {
  it('shows the app when unlocked', () => {
    render(
      <LockGate>
        <Text>{SECRET}</Text>
      </LockGate>,
    );

    expect(screen.getByText(SECRET)).toBeTruthy();
  });

  /**
   * The security property the whole lock rests on. An overlay would leave the
   * records mounted underneath — readable by a screen reader, present in a
   * crash dump, and captured by the app-switcher snapshot. They must not be
   * rendered at all.
   */
  it('does not render the records at all while locked', async () => {
    reset({ locked: true });

    render(
      <LockGate>
        <Text>{SECRET}</Text>
      </LockGate>,
    );

    // The lock screen prompts for a face on mount; let that settle so the
    // resulting state update is inside act().
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText(SECRET)).toBeNull();
    expect(screen.getByText('Nalvita is locked')).toBeTruthy();
  });

  it('hides the records while the app is backgrounded, before it is even locked', () => {
    reset({ obscured: true });

    render(
      <LockGate>
        <Text>{SECRET}</Text>
      </LockGate>,
    );

    expect(screen.queryByText(SECRET)).toBeNull();
  });

  /**
   * Someone who switched the lock off has accepted the trade; blanking their
   * screen on every app switch would be a lock they did not ask for.
   */
  it('leaves the app visible on backgrounding when the lock is switched off', () => {
    reset({ obscured: true, enabled: false });

    render(
      <LockGate>
        <Text>{SECRET}</Text>
      </LockGate>,
    );

    expect(screen.getByText(SECRET)).toBeTruthy();
  });
});

describe('the offline banner', () => {
  it('stays out of the way when there is a connection', () => {
    render(<OfflineBanner />);

    expect(screen.queryByText('You are offline')).toBeNull();
  });

  it('says what still works when there is not', () => {
    jest.mocked(Network.useNetworkState).mockReturnValue({
      isConnected: false,
      isInternetReachable: false,
    } as never);

    render(<OfflineBanner />);

    expect(screen.getByText('You are offline')).toBeTruthy();
    expect(screen.getByText(/allergies, medicines and emergency details/i)).toBeTruthy();
  });
});
