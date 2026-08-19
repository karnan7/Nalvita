import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { OfflineBanner } from '@/components/offline-banner';
import { spacing, typeScale, useTheme } from '@/lib/theme';

interface ScreenProps {
  title: string;
  /** One plain sentence saying what this screen is for. */
  subtitle?: string;
  children?: ReactNode;
}

/** The common page frame: themed background, heading, scrollable body. */
export function Screen({ title, subtitle, children }: Readonly<ScreenProps>) {
  const theme = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bgApp }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[typeScale.heading1, { color: theme.colors.textPrimary }]}>{title}</Text>
        {subtitle ? (
          <Text style={[typeScale.body, styles.subtitle, { color: theme.colors.textSecondary }]}>
            {subtitle}
          </Text>
        ) : null}
        {/* Every screen, rather than screen by screen: a new screen is covered
            by default, the same reasoning as the screen-capture block. */}
        <OfflineBanner />
        {children}
      </ScrollView>
    </View>
  );
}

/** A bordered card, matching the web app's SectionCard. */
export function Card({ children }: Readonly<{ children: ReactNode }>) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderDefault },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md },
  subtitle: { marginTop: -spacing.sm },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
});
