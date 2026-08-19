import { useQueryClient } from '@tanstack/react-query';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * The biometric lock.
 *
 * A phone is left on tables, lent to children, and stolen. The session in the
 * keystore survives all of that, so without a lock, physical possession of an
 * unlocked phone is possession of someone's complete health record.
 *
 * Two separate ideas live here, and conflating them is the usual mistake:
 *
 * - **Obscured** — the app is not frontmost. Applied the instant iOS reports
 *   `inactive`, because that is when the OS takes the app-switcher snapshot. If
 *   the lock screen is not already up at that moment, the snapshot is of
 *   somebody's medicines, and it persists on disk.
 * - **Locked** — the app was away long enough to need a face or a fingerprint
 *   back. Five minutes, so the common case of glancing at a message and coming
 *   straight back does not become a reason to switch the lock off.
 *
 * Locking clears the React Query cache rather than covering it. An overlay
 * leaves every record in memory and in the component tree, one crash report or
 * one accessibility scrape away from being read. This unmounts it.
 */

/** How long the app may sit in the background before it demands a face. */
export const LOCK_AFTER_MS = 5 * 60 * 1000;

/** Where the opt-out lives. Not health data, but it belongs with the keystore. */
const PREFERENCE_KEY = 'nalvita.lock.enabled';

export interface LockState {
  /** True when the app must be unlocked before anything is shown. */
  locked: boolean;
  /** True while the app is not frontmost — covers the app-switcher snapshot. */
  obscured: boolean;
  /** Whether the lock is switched on. */
  enabled: boolean;
  /** False when the device has no biometric hardware, or nothing enrolled. */
  available: boolean;
  /** True until the stored preference and hardware support are known. */
  isLoading: boolean;
  setEnabled: (next: boolean) => void;
  /** Prompts for a face/fingerprint. Resolves true when it unlocked. */
  unlock: () => Promise<boolean>;
}

const LockContext = createContext<LockState | null>(null);

export function useLock(): LockState {
  const value = useContext(LockContext);
  if (!value) throw new Error('useLock must be used inside a LockProvider');
  return value;
}

/**
 * Whether this device can do a biometric check at all.
 *
 * Hardware alone is not enough — a phone with a fingerprint reader nobody has
 * enrolled cannot authenticate, and offering the toggle there would lock people
 * out of their own records.
 */
async function checkAvailability(): Promise<boolean> {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
}

export function LockProvider({ children }: Readonly<{ children: ReactNode }>) {
  const queryClient = useQueryClient();

  const [available, setAvailable] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [obscured, setObscured] = useState(false);

  /** When the app went away. Null while it is frontmost. */
  const backgroundedAt = useRef<number | null>(null);

  /** Read in the AppState listener, which must not be re-subscribed per change. */
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [supported, stored] = await Promise.all([
        checkAvailability(),
        SecureStore.getItemAsync(PREFERENCE_KEY),
      ]);
      if (cancelled) return;

      setAvailable(supported);
      // On by default wherever the device can do it: this guards health data,
      // so it should protect people who never open settings.
      setEnabledState(supported && stored !== 'false');
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const lock = useCallback(() => {
    setLocked(true);
    // The point of locking: the records leave memory, not just the screen.
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    const handleChange = (next: AppStateStatus) => {
      if (next === 'active') {
        setObscured(false);

        const since = backgroundedAt.current;
        backgroundedAt.current = null;

        if (enabledRef.current && since !== null && Date.now() - since >= LOCK_AFTER_MS) {
          lock();
        }
        return;
      }

      // `inactive` is the iOS app-switcher moment and the incoming-call
      // moment; `background` is a real departure. Obscure on both, but only
      // start the clock on a real departure so a permissions dialog does not
      // count as leaving.
      setObscured(true);
      if (next === 'background') {
        backgroundedAt.current ??= Date.now();
      }
    };

    const subscription = AppState.addEventListener('change', handleChange);
    return () => subscription.remove();
  }, [lock]);

  const unlock = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Nalvita',
      // Falling back to the device passcode keeps someone whose face fails in
      // bad light from being shut out of their own records.
      disableDeviceFallback: false,
    });

    if (result.success) {
      setLocked(false);
      return true;
    }
    return false;
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    void SecureStore.setItemAsync(PREFERENCE_KEY, next ? 'true' : 'false');
    // Switching the lock off should take effect now, not after the next
    // background — otherwise the toggle appears not to work.
    if (!next) setLocked(false);
  }, []);

  const value = useMemo<LockState>(
    () => ({ locked, obscured, enabled, available, isLoading, setEnabled, unlock }),
    [locked, obscured, enabled, available, isLoading, setEnabled, unlock],
  );

  return <LockContext.Provider value={value}>{children}</LockContext.Provider>;
}
