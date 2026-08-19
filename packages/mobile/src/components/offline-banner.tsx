import WifiOff from 'lucide-react-native/icons/wifi-off';
import { StyleSheet, Text, View } from 'react-native';

import { useIsOnline } from '@/lib/network';
import { radius, spacing, typeScale, useTheme } from '@/lib/theme';

/**
 * Says plainly when the app is working from the offline cache.
 *
 * Amber rather than red: being offline is a state to know about, not an
 * emergency, and red is reserved for allergies and critical readings. The copy
 * says what someone can still rely on rather than what has broken — "no
 * connection" alone leaves people wondering whether what is on screen is real.
 */
export function OfflineBanner() {
  const theme = useTheme();
  const online = useIsOnline();

  if (online) return null;

  const pair = theme.status.high;

  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor: pair.bg, borderColor: pair.fg }]}
    >
      <WifiOff color={pair.fg} size={18} />
      <View style={styles.body}>
        <Text style={[typeScale.label, { color: pair.fg }]}>You are offline</Text>
        <Text style={[typeScale.caption, { color: pair.fg }]}>
          Showing your allergies, medicines and emergency details from this phone. Everything else
          needs a connection.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  body: { flex: 1, gap: 2 },
});
