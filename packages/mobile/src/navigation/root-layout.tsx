import { AuthProvider, NalvitaDataProvider, useAuth, useProfile } from '@nalvita/data';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { mobilePlatform } from '@/lib/platform';
import { watchAppStateForAuthRefresh } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

const queryClient = new QueryClient();

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

  return (
    <SafeAreaProvider>
      <NalvitaDataProvider {...mobilePlatform}>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />
            {refreshReady ? <AuthGate /> : null}
          </QueryClientProvider>
        </AuthProvider>
      </NalvitaDataProvider>
    </SafeAreaProvider>
  );
}
