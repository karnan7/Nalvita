import { onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';

/**
 * Connectivity, and telling React Query about it.
 *
 * `expo-network` rather than `@react-native-community/netinfo`: it is a
 * first-party Expo module covering the same ground, so it is one less
 * third-party native dependency to keep aligned with the SDK.
 */

/**
 * A phone can hold a wifi association that routes nowhere — a captive portal,
 * a router with no upstream. `isInternetReachable` is the honest signal;
 * `isConnected` only says a radio is associated. When reachability is still
 * being determined it is undefined, and we fall back to the weaker signal
 * rather than flashing an offline banner at someone who is fine.
 */
export function isOnlineFrom(state: {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}): boolean {
  return state.isInternetReachable ?? state.isConnected ?? true;
}

/**
 * Binds React Query's online state to the device's.
 *
 * Without this, React Query assumes it is always online on React Native: it
 * would fire queries into a dead network, fail them, and — worse for us — not
 * know to refetch when signal comes back. With it, queries pause while offline
 * and resume on reconnect, which is the whole "sync on reconnect" behaviour.
 *
 * Returns the unsubscribe, to be called on teardown.
 */
export function startOnlineManagerSync(): () => void {
  onlineManager.setEventListener((setOnline) => {
    const subscription = Network.addNetworkStateListener((state) => {
      setOnline(isOnlineFrom(state));
    });

    // The listener only fires on change, so seed it with the current state —
    // otherwise an app launched in aeroplane mode believes it is online until
    // something changes.
    void Network.getNetworkStateAsync()
      .then((state) => setOnline(isOnlineFrom(state)))
      .catch(() => setOnline(true));

    return () => subscription.remove();
  });

  return () => onlineManager.setEventListener(() => () => undefined);
}

/** Whether the device currently has usable internet. */
export function useIsOnline(): boolean {
  const state = Network.useNetworkState();
  return isOnlineFrom(state);
}
