import type { NalvitaStatus } from '@nalvita/core';
// `triangle-alert`, not `alert-triangle`: lucide renamed it and kept the old
// name as a type-only alias, so the deprecated spelling typechecks but has no
// runtime file behind it. Only a real bundle or render catches that.
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import type { ComponentType, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typeScale, useTheme } from '@/lib/theme';

/**
 * The mobile half of the Nalvita design system.
 *
 * Deliberately mirrors `packages/web/src/components/ui-nalvita/` piece for
 * piece — same names, same meanings, same colours from `@nalvita/core`. Web
 * expresses them as Tailwind classes over CSS variables; here they are plain
 * styles over the same token values. Nothing below hard-codes a colour.
 */

/** A dashboard metric: icon chip, the value, then what it counts. */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  isLoading = false,
  onPress,
}: Readonly<{
  icon: ComponentType<{ color?: string; size?: number }>;
  label: string;
  value: string;
  hint?: string;
  isLoading?: boolean;
  onPress?: () => void;
}>) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={[
        styles.statCard,
        { backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderDefault },
      ]}
    >
      <View style={[styles.chip, { backgroundColor: theme.status.normal.bg }]}>
        <Icon color={theme.status.normal.fg} size={18} />
      </View>
      {isLoading ? (
        <ActivityIndicator color={theme.colors.interactiveDefault} />
      ) : (
        <Text style={[typeScale.heading2, { color: theme.colors.textPrimary }]}>{value}</Text>
      )}
      <Text style={[typeScale.label, { color: theme.colors.textSecondary }]}>{label}</Text>
      {hint ? (
        <Text style={[typeScale.caption, { color: theme.colors.textMuted }]}>{hint}</Text>
      ) : null}
    </Pressable>
  );
}

/** A titled card grouping related rows, optionally with an action in the header. */
export function SectionCard({
  title,
  action,
  children,
}: Readonly<{ title: string; action?: ReactNode; children: ReactNode }>) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.section,
        { backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderDefault },
      ]}
    >
      <View style={styles.sectionHeader}>
        <Text style={[typeScale.heading3, { color: theme.colors.textPrimary }]}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

/**
 * Health status pill. `normal` = green, `high` = amber/borderline, `low` = blue,
 * `critical` = red alert — the shared meanings, not decoration.
 */
export function StatusBadge({
  variant,
  children,
}: Readonly<{ variant: NalvitaStatus; children: ReactNode }>) {
  const theme = useTheme();
  const pair = theme.status[variant];

  return (
    <View style={[styles.badge, { backgroundColor: pair.bg }]}>
      <Text style={[typeScale.caption, { color: pair.fg }]}>{children}</Text>
    </View>
  );
}

/**
 * Shown when there is nothing yet. Pass `title` for a standalone prompt, or
 * just `children` for a quiet line inside a card.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  children,
}: Readonly<{
  icon?: ComponentType<{ color?: string; size?: number }>;
  title?: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
}>) {
  const theme = useTheme();

  if (!title) {
    return (
      <Text style={[typeScale.body, { color: theme.colors.textMuted }]}>{children}</Text>
    );
  }

  return (
    <View style={styles.empty}>
      {Icon ? <Icon color={theme.colors.textMuted} size={32} /> : null}
      <Text style={[typeScale.heading3, styles.centred, { color: theme.colors.textPrimary }]}>
        {title}
      </Text>
      {description ? (
        <Text style={[typeScale.body, styles.centred, { color: theme.colors.textSecondary }]}>
          {description}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

/**
 * The red banner. Reserved for things that matter in an emergency — allergies,
 * above all. Impossible to miss, by design.
 */
export function AlertBanner({
  title,
  children,
  onPress,
}: Readonly<{ title: string; children: ReactNode; onPress?: () => void }>) {
  const theme = useTheme();
  const pair = theme.status.critical;

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={[styles.banner, { backgroundColor: pair.bg, borderColor: pair.fg }]}
    >
      <TriangleAlert color={pair.fg} size={20} />
      <View style={styles.bannerBody}>
        <Text style={[typeScale.label, { color: pair.fg }]}>{title}</Text>
        <Text style={[typeScale.body, { color: pair.fg }]}>{children}</Text>
      </View>
    </Pressable>
  );
}

/** A labelled value, the unit rows across the profile and detail screens. */
export function DetailRow({ label, value }: Readonly<{ label: string; value: string }>) {
  const theme = useTheme();

  return (
    <View style={styles.detailRow}>
      <Text style={[typeScale.label, { color: theme.colors.textMuted }]}>{label}</Text>
      <Text style={[typeScale.body, styles.detailValue, { color: theme.colors.textPrimary }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statCard: {
    flexGrow: 1,
    flexBasis: '46%',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  chip: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  centred: { textAlign: 'center' },
  banner: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  bannerBody: { flex: 1, gap: 2 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  detailValue: { flexShrink: 1, textAlign: 'right' },
});
