import { CIRCLE_ROLE_LABELS, describeCategories, useAcceptInvite, useInvitePreview } from '@nalvita/data';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { Card, Screen } from '@/components/screen';
import { radius, spacing, typeScale, useTheme } from '@/lib/theme';

/**
 * Where an invite link lands: `nalvita://family/join?token=…`, the same shape
 * as the web route so one link works wherever it is opened.
 *
 * The secret is only ever exchanged for a *preview* until the person agrees —
 * opening a link must never be what joins a circle.
 */
export function JoinInviteScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const secret = token ?? null;

  const { data: invite, isPending, isError } = useInvitePreview(secret);
  const acceptInvite = useAcceptInvite();

  if (!secret) {
    return <Screen title="Invite" subtitle="This link is missing its invite code." />;
  }
  if (isPending) {
    return (
      <Screen title="Invite">
        <ActivityIndicator color={theme.colors.interactiveDefault} />
      </Screen>
    );
  }
  if (isError || !invite) {
    return (
      <Screen
        title="Invite"
        subtitle="This invite has expired or has already been used. Ask for a new one."
      />
    );
  }

  const who = invite.owner_name?.trim() || 'A family member';

  return (
    <Screen title="Join a circle">
      <Card>
        <Text style={[typeScale.heading3, { color: theme.colors.textPrimary }]}>
          {who} wants to share their health records with you
        </Text>
        <Text style={[typeScale.body, { color: theme.colors.textSecondary }]}>
          You would get {CIRCLE_ROLE_LABELS[invite.requested_role].toLowerCase()} access to{' '}
          {describeCategories(invite.requested_categories)}.
        </Text>
        <Text style={[typeScale.caption, { color: theme.colors.textMuted }]}>
          You can leave at any time, and they can change or remove your access whenever they want.
        </Text>
      </Card>

      <Pressable
        accessibilityRole="button"
        disabled={acceptInvite.isPending}
        onPress={() =>
          acceptInvite.mutate(secret, { onSuccess: () => router.replace('/') })
        }
        style={[
          styles.primary,
          {
            backgroundColor: acceptInvite.isPending
              ? theme.colors.interactiveDisabled
              : theme.colors.interactiveDefault,
          },
        ]}
      >
        <Text style={[typeScale.label, { color: theme.colors.textInverse }]}>
          {acceptInvite.isPending ? 'Joining…' : 'Accept and join'}
        </Text>
      </Pressable>

      <Pressable accessibilityRole="button" onPress={() => router.replace('/')}>
        <Text style={[typeScale.label, styles.centred, { color: theme.colors.textSecondary }]}>
          Not now
        </Text>
      </Pressable>

      {acceptInvite.isError ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[typeScale.body, styles.centred, { color: theme.status.critical.fg }]}
        >
          We could not join that circle. The invite may have expired.
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centred: { textAlign: 'center' },
  primary: { borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
});
