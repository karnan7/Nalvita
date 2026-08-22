import { AuthProvider, NalvitaDataProvider, useAuth, useProfile } from '@nalvita/data';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LockGate } from '@/components/lock-screen';
import { ActiveProfileProvider } from '@/lib/active-profile';
import { LockProvider } from '@/lib/lock';
import { startOnlineManagerSync } from '@/lib/network';
import { clearOfflineCache } from '@/lib/offline-cache';
import { useEmergencyCacheSync } from '@/lib/offline-emergency';
import { usePushRegistration } from '@/lib/push';
import { mobilePlatform } from '@/lib/platform';
import { watchAppStateForAuthRefresh } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

const queryClient = new QueryClient();

/**
 * Keeps the offline emergency set current, and wipes it on sign-out.
 *
 * Rendered rather than called from a screen so it runs for the whole signed-in
 * session: the cache should be warm before someone loses signal, not written
 * the first time they happen to open the dashboard.
 */
function EmergencyCache() {
  const { session } = useAuth();
  useEmergencyCacheSync();

  const wasSignedIn = useRef(false);

  useEffect(() => {
    if (session) {
      wasSignedIn.current = true;
      return;
    }

    // Only on the transition out of a session — otherwise every cold start
    // while signed out would churn the encryption key for no reason.
    if (wasSignedIn.current) {
      wasSignedIn.current = false;
      // The next person to hold this phone must not find the last one's
      // allergy list sitting in it.
      void clearOfflineCache();
    }
  }, [session]);

  return null;
}

/**
 * Makes this phone reachable while somebody is signed in.
 *
 * Failure is deliberately silent, inside the hook. Someone who refused
 * notifications, or who is on a simulator, or who is offline, must still get a
 * working app — push is an addition to Nalvita, never a precondition for it.
 */
function PushRegistration() {
  usePushRegistration();
  return null;
}

/**
 * Sends people to the right place for their signed-in state.
 *
 * Deliberately a redirect rather than conditional rendering: expo-router owns
 * the URL, and deep links land on a route before this runs. Someone opening an
 * invite link while signed out should reach the login screen and then continue
 * to the invite — not have the link silently swallowed.
 */
export function AuthGate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const theme = useTheme();

  // Records belong to profiles, so a signed-in person still needs their profile
  // row before any screen can ask for anything.
  const { isPending: profilePending } = useProfile(session?.user.id);

  const inAuthGroup = segments[0] === 'login';

  useEffect(() => {
    if (loading) return;

    if (!session && !inAuthGroup) {
      router.replace('/login');
    } else if (session && inAuthGroup) {
      router.replace('/');
    }
  }, [session, loading, inAuthGroup, router]);

  if (loading || (session && profilePending)) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.bgApp,
        }}
      >
        <ActivityIndicator color={theme.colors.interactiveDefault} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="family/join" options={{ headerShown: true, title: 'Join a circle' }} />
    </Stack>
  );
}

export function RootLayout() {
  const theme = useTheme();
  const [refreshReady, setRefreshReady] = useState(false);

  // Token refresh follows foreground state; see watchAppStateForAuthRefresh.
  useEffect(() => {
    const stop = watchAppStateForAuthRefresh();
    setRefreshReady(true);
    return stop;
  }, []);

  // React Query assumes it is always online on React Native unless told
  // otherwise; this is what makes queries pause offline and resume on
  // reconnect.
  useEffect(() => startOnlineManagerSync(), []);

  return (
    <SafeAreaProvider>
      <NalvitaDataProvider {...mobilePlatform}>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <ActiveProfileProvider>
              <LockProvider>
                <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />
                <EmergencyCache />
                <PushRegistration />
                {/* Nothing below this renders while the app is locked. */}
                <LockGate>{refreshReady ? <AuthGate /> : null}</LockGate>
              </LockProvider>
            </ActiveProfileProvider>
          </QueryClientProvider>
        </AuthProvider>
      </NalvitaDataProvider>
    </SafeAreaProvider>
  );
}
