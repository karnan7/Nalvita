// Web Crypto is not built into React Native. `@nalvita/data` generates invite
// and handover secrets with `crypto.getRandomValues`, and Supabase's PKCE flow
// needs it too, so the polyfill has to be imported before anything uses it.
import 'react-native-get-random-values';

import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { secureStorage } from '@/lib/secure-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to packages/mobile/.env and fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // The session lives in the device keystore, not AsyncStorage.
    storage: secureStorage,
    persistSession: true,
    autoRefreshToken: true,
    // There is no URL bar to read a session out of; deep links are handled by
    // the router instead. Leaving this on makes Supabase wait for a `window`
    // that never arrives.
    detectSessionInUrl: false,
    // Same reasoning as web: no server to hold a client secret.
    flowType: 'pkce',
  },
});

/**
 * Refresh only while the app is in front of the person using it.
 *
 * Supabase's timer does not know about app lifecycle: left running it wakes a
 * backgrounded app to refresh a token nobody is waiting on, and iOS may kill it
 * for the trouble. Starting and stopping with foreground state also means a
 * phone that has been in a pocket for a day refreshes once on resume rather
 * than replaying every missed interval.
 */
export function watchAppStateForAuthRefresh(): () => void {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });

  if (AppState.currentState === 'active') {
    void supabase.auth.startAutoRefresh();
  }

  return () => {
    subscription.remove();
    void supabase.auth.stopAutoRefresh();
  };
}
