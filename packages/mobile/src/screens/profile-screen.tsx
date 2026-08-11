import { useAuth, useProfile, useSupabase } from '@nalvita/data';
import { Pressable, Text } from 'react-native';

import { Card, Screen } from '@/components/screen';
import { radius, spacing, typeScale, useTheme } from '@/lib/theme';

export function ProfileScreen() {
  const theme = useTheme();
  const supabase = useSupabase();
  const { session } = useAuth();
  const { data: profile } = useProfile(session?.user.id);

  return (
    <Screen title="Profile" subtitle="Your details and how you sign in.">
      <Card>
        <Text style={[typeScale.label, { color: theme.colors.textMuted }]}>Name</Text>
        <Text style={[typeScale.body, { color: theme.colors.textPrimary }]}>
          {profile?.full_name?.trim() || 'Not set'}
        </Text>
        <Text style={[typeScale.label, { color: theme.colors.textMuted }]}>Signed in as</Text>
        <Text style={[typeScale.body, { color: theme.colors.textPrimary }]}>
          {session?.user.email ?? 'Unknown'}
        </Text>
      </Card>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void supabase.auth.signOut();
        }}
        style={{
          backgroundColor: theme.colors.bgSurface,
          borderColor: theme.colors.borderStrong,
          borderWidth: 1,
          borderRadius: radius.md,
          padding: spacing.md,
          alignItems: 'center',
        }}
      >
        <Text style={[typeScale.label, { color: theme.colors.textPrimary }]}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}
