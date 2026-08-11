import { useAuth, useProfile } from '@nalvita/data';
import { Text } from 'react-native';

import { Card, Screen } from '@/components/screen';
import { typeScale, useTheme } from '@/lib/theme';

/**
 * Home. The screens themselves land in KAR-57 — what this proves today is that
 * the whole stack is connected: a session from the device keystore, a profile
 * read through `@nalvita/data`, and RLS letting it through.
 */
export function HomeScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const { data: profile, isPending, isError } = useProfile(session?.user.id);

  const greeting = profile?.full_name?.trim() ? `Hello, ${profile.full_name.trim()}` : 'Hello';

  return (
    <Screen title={greeting} subtitle="Your health, in one place.">
      <Card>
        <Text style={[typeScale.heading3, { color: theme.colors.textPrimary }]}>
          You are signed in
        </Text>
        <Text style={[typeScale.body, { color: theme.colors.textSecondary }]}>
          {renderProfileState({ isPending, isError, hasProfile: Boolean(profile) })}
        </Text>
      </Card>
    </Screen>
  );
}

function renderProfileState({
  isPending,
  isError,
  hasProfile,
}: Readonly<{ isPending: boolean; isError: boolean; hasProfile: boolean }>): string {
  if (isPending) return 'Loading your profile…';
  if (isError) return 'We could not load your profile. Pull down to try again.';
  if (!hasProfile) return 'Your profile is not set up yet.';
  return 'Your dashboard, documents, medicines, and vitals arrive in the next update.';
}
