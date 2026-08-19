import { onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';

import { isOnlineFrom, startOnlineManagerSync } from '@/lib/network';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('reading the connection', () => {
  /**
   * A phone can hold a wifi association that routes nowhere — a captive portal,
   * a router with no upstream. Trusting `isConnected` there would leave someone
   * staring at spinners with no explanation.
   */
  it('believes reachability over mere association', () => {
    expect(isOnlineFrom({ isConnected: true, isInternetReachable: false })).toBe(false);
  });

  it('falls back to association while reachability is unknown', () => {
    expect(isOnlineFrom({ isConnected: false, isInternetReachable: undefined })).toBe(false);
    expect(isOnlineFrom({ isConnected: true, isInternetReachable: undefined })).toBe(true);
  });

  /**
   * Assuming online when nothing is known is the kinder default: a spurious
   * offline banner tells people their records are stale when they are not.
   */
  it('assumes online when the platform says nothing', () => {
    expect(isOnlineFrom({})).toBe(true);
  });

  it('treats null the way it treats undefined', () => {
    expect(isOnlineFrom({ isConnected: null, isInternetReachable: null })).toBe(true);
  });
});

describe('telling React Query about it', () => {
  it('seeds the current state rather than waiting for a change', async () => {
    jest.mocked(Network.getNetworkStateAsync).mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    } as never);

    const stop = startOnlineManagerSync();
    // The seed is a promise; let it settle.
    await Promise.resolve();
    await Promise.resolve();

    expect(onlineManager.isOnline()).toBe(false);
    stop();
  });

  it('follows the device on to reconnect, which is what resumes queries', async () => {
    type Emit = (state: { isConnected: boolean; isInternetReachable: boolean }) => void;
    // Held on an object rather than in a `let`: TypeScript does not track an
    // assignment made inside the mock callback and narrows the variable to
    // `never`.
    const listener: { emit?: Emit } = {};

    jest.mocked(Network.addNetworkStateListener).mockImplementation((handler) => {
      listener.emit = handler as unknown as Emit;
      return { remove: jest.fn() } as never;
    });
    jest.mocked(Network.getNetworkStateAsync).mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    } as never);

    const stop = startOnlineManagerSync();
    await Promise.resolve();
    await Promise.resolve();
    expect(onlineManager.isOnline()).toBe(false);

    listener.emit?.({ isConnected: true, isInternetReachable: true });

    expect(onlineManager.isOnline()).toBe(true);
    stop();
  });

  it('does not leave the app stuck offline when the platform check throws', async () => {
    jest.mocked(Network.getNetworkStateAsync).mockRejectedValue(new Error('no radio'));

    const stop = startOnlineManagerSync();
    await Promise.resolve();
    await Promise.resolve();

    expect(onlineManager.isOnline()).toBe(true);
    stop();
  });
});
