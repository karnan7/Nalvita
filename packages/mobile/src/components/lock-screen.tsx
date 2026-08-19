import LockIcon from 'lucide-react-native/icons/lock';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLock } from '@/lib/lock';
import { radius, spacing, typeScale, useTheme } from '@/lib/theme';

/**
 * What replaces the app when it is locked.
 *
 * Prompts for a face as soon as it appears, so the common path is: pick the
 * phone up, look at it, carry on. The button exists for the case where that
 * prompt was dismissed, or the face check failed.
 */
export function LockScreen() {
  const theme = useTheme();
  const { unlock } = useLock();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  /** React 18 mounts effects twice in dev; a second prompt would stack. */
  const prompted = useRef(false);

  const attempt = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await unlock();
    setBusy(false);
    setFailed(!ok);
  };

  useEffect(() => {
    if (prompted.current) return;
    prompted.current = true;
    void attempt();
    // Deliberately once on mount: re-prompting on every render change would
    // trap someone in a loop of system dialogs they cannot dismiss.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.fill, styles.centre, { backgroundColor: theme.colors.bgApp }]}>
      <View style={[styles.chip, { backgroundColor: theme.colors.bgRaised }]}>
        <LockIcon color={theme.colors.interactiveDefault} size={28} />
      </View>

      <Text style={[typeScale.heading2, { color: theme.colors.textPrimary }]}>Nalvita is locked</Text>
      <Text style={[typeScale.body, styles.centred, { color: theme.colors.textSecondary }]}>
        {failed
          ? 'That did not work. Try again to see your records.'
          : 'Unlock to see your health records.'}
      </Text>

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => {
          void attempt();
        }}
        style={[styles.button, { backgroundColor: theme.colors.interactiveDefault }]}
      >
        <Text style={[typeScale.label, { color: theme.colors.textInverse }]}>
          {busy ? 'Unlocking…' : 'Unlock'}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Stands between the lock and the rest of the app.
 *
 * Children are not rendered while locked or backgrounded — not hidden, not
 * covered, not rendered. An overlay would leave the records mounted underneath,
 * which the app-switcher snapshot and any screen reader would happily walk
 * straight through.
 */
export function LockGate({ children }: Readonly<{ children: ReactNode }>) {
  const theme = useTheme();
  const { locked, obscured, enabled } = useLock();

  if (locked) return <LockScreen />;

  // Backgrounded with the lock on: show a blank Nalvita-coloured screen, which
  // is what the OS then captures for the app switcher.
  if (obscured && enabled) {
    return <View style={[styles.fill, { backgroundColor: theme.colors.bgApp }]} />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centre: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  centred: { textAlign: 'center' },
  chip: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
});
