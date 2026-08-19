import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { AppState, Pressable, Text, type AppStateStatus } from 'react-native';

import { LOCK_AFTER_MS, LockProvider, useLock } from '@/lib/lock';

/** The AppState handler the provider registers, so tests can drive lifecycle. */
let appStateHandler: ((status: AppStateStatus) => void) | null = null;

function Probe() {
  const { locked, obscured, enabled, available, isLoading } = useLock();
  return (
    <Text>
      {`locked:${locked} obscured:${obscured} enabled:${enabled} available:${available} loading:${isLoading}`}
    </Text>
  );
}

/** Probe plus a way to trigger the face check, standing in for the lock screen. */
function UnlockProbe() {
  const { unlock } = useLock();
  return (
    <>
      <Probe />
      <Pressable
        onPress={() => {
          void unlock();
        }}
      >
        <Text>unlock</Text>
      </Pressable>
    </>
  );
}

/** Probe plus the settings toggle, standing in for the profile screen. */
function TogglePersistProbe() {
  const { setEnabled } = useLock();
  return (
    <>
      <Probe />
      <Pressable onPress={() => setEnabled(false)}>
        <Text>turn off</Text>
      </Pressable>
    </>
  );
}

function state() {
  return screen.getByText(/locked:/).props.children as string;
}

let queryClient: QueryClient;

async function mount(ui = <Probe />) {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <LockProvider>{ui}</LockProvider>
    </QueryClientProvider>,
  );
  // The provider reads hardware support and the stored preference on mount.
  await act(async () => {
    await Promise.resolve();
  });
  return result;
}

/** Sends the app away for `awayMs` and brings it back. */
async function goAwayAndReturn(awayMs: number) {
  const departed = Date.now();
  jest.spyOn(Date, 'now').mockReturnValue(departed);
  await act(async () => {
    appStateHandler?.('background');
  });

  jest.spyOn(Date, 'now').mockReturnValue(departed + awayMs);
  await act(async () => {
    appStateHandler?.('active');
  });
}

beforeEach(() => {
  appStateHandler = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    appStateHandler = handler as (status: AppStateStatus) => void;
    return { remove: jest.fn() } as never;
  });

  jest.mocked(LocalAuthentication.hasHardwareAsync).mockResolvedValue(true);
  jest.mocked(LocalAuthentication.isEnrolledAsync).mockResolvedValue(true);
  jest.mocked(LocalAuthentication.authenticateAsync).mockResolvedValue({ success: true } as never);
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('locking on the way back', () => {
  it('locks after five minutes away', async () => {
    await mount();

    await goAwayAndReturn(LOCK_AFTER_MS);

    expect(state()).toContain('locked:true');
  });

  it('does not lock on a quick glance away', async () => {
    await mount();

    await goAwayAndReturn(LOCK_AFTER_MS - 1000);

    expect(state()).toContain('locked:false');
  });

  it('stays unlocked when the lock is switched off', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('false');
    await mount();

    await goAwayAndReturn(LOCK_AFTER_MS * 2);

    expect(state()).toContain('locked:false');
  });

  it('does not lock a device with no biometrics enrolled', async () => {
    jest.mocked(LocalAuthentication.isEnrolledAsync).mockResolvedValue(false);
    await mount();

    expect(state()).toContain('available:false');
    await goAwayAndReturn(LOCK_AFTER_MS * 2);

    expect(state()).toContain('locked:false');
  });
});

describe('the app switcher', () => {
  /**
   * iOS snapshots the app the moment it goes `inactive`. If the records are
   * still on screen then, that snapshot is of somebody's medicines and it
   * persists on disk — so obscuring has to happen before `background`.
   */
  it('obscures on inactive, not only on background', async () => {
    await mount();

    await act(async () => {
      appStateHandler?.('inactive');
    });

    expect(state()).toContain('obscured:true');
  });

  it('reveals again on return', async () => {
    await mount();

    await act(async () => {
      appStateHandler?.('inactive');
    });
    await act(async () => {
      appStateHandler?.('active');
    });

    expect(state()).toContain('obscured:false');
  });

  /**
   * A permissions dialog or an incoming call reports `inactive` without the
   * app ever leaving. Starting the lock clock there would lock people out
   * mid-task.
   */
  it('does not start the clock for a dialog that never backgrounds the app', async () => {
    await mount();

    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    await act(async () => {
      appStateHandler?.('inactive');
    });

    jest.spyOn(Date, 'now').mockReturnValue(now + LOCK_AFTER_MS * 2);
    await act(async () => {
      appStateHandler?.('active');
    });

    expect(state()).toContain('locked:false');
  });
});

describe('what locking does to the records', () => {
  /**
   * The whole point: an overlay would leave every record in memory. Locking
   * has to empty the cache, not cover it.
   */
  it('clears the query cache rather than covering the screen', async () => {
    await mount();
    queryClient.setQueryData(['allergies', 'p1'], [{ allergen: 'Penicillin' }]);

    await goAwayAndReturn(LOCK_AFTER_MS);

    expect(queryClient.getQueryData(['allergies', 'p1'])).toBeUndefined();
  });
});

describe('unlocking', () => {
  it('comes back unlocked when the face check passes', async () => {
    await mount(<UnlockProbe />);
    await goAwayAndReturn(LOCK_AFTER_MS);
    expect(state()).toContain('locked:true');

    fireEvent.press(screen.getByText('unlock'));
    await act(async () => {
      await Promise.resolve();
    });

    expect(state()).toContain('locked:false');
  });

  it('stays locked when the face check fails', async () => {
    jest.mocked(LocalAuthentication.authenticateAsync).mockResolvedValue({
      success: false,
    } as never);
    await mount(<UnlockProbe />);
    await goAwayAndReturn(LOCK_AFTER_MS);

    fireEvent.press(screen.getByText('unlock'));
    await act(async () => {
      await Promise.resolve();
    });

    expect(state()).toContain('locked:true');
  });

  it('offers the device passcode, so a face that fails in bad light is not a lockout', async () => {
    await mount(<UnlockProbe />);
    await goAwayAndReturn(LOCK_AFTER_MS);

    fireEvent.press(screen.getByText('unlock'));
    await act(async () => {
      await Promise.resolve();
    });

    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ disableDeviceFallback: false }),
    );
  });
});

describe('the preference', () => {
  it('is on by default wherever the device supports it', async () => {
    await mount();

    expect(state()).toContain('enabled:true');
  });

  it('is remembered once switched off', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('false');
    await mount();

    expect(state()).toContain('enabled:false');
  });

  it('writes the choice to the keystore, so it survives a restart', async () => {
    await mount(<TogglePersistProbe />);

    fireEvent.press(screen.getByText('turn off'));
    await act(async () => {
      await Promise.resolve();
    });

    expect(state()).toContain('enabled:false');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('nalvita.lock.enabled', 'false');
  });

  /**
   * Switching the lock off has to take effect on the spot. Leaving someone
   * staring at a lock screen after they turned the lock off reads as the toggle
   * being broken, and the way out of it is a face check they just opted out of.
   */
  it('unlocks immediately when switched off, rather than at the next background', async () => {
    await mount(<TogglePersistProbe />);
    await goAwayAndReturn(LOCK_AFTER_MS);
    expect(state()).toContain('locked:true');

    // The module mock is shared across this file, so the question is whether
    // *this* toggle prompted, not whether anything ever has.
    const promptsBefore = jest.mocked(LocalAuthentication.authenticateAsync).mock.calls.length;

    fireEvent.press(screen.getByText('turn off'));
    await act(async () => {
      await Promise.resolve();
    });

    expect(state()).toContain('locked:false');
    expect(jest.mocked(LocalAuthentication.authenticateAsync).mock.calls).toHaveLength(
      promptsBefore,
    );
  });
});
