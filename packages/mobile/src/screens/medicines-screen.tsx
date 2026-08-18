import type { Medicine } from '@nalvita/core';
import {
  formatMedDate,
  isMedicinePast,
  isRefillDue,
  MEDICINE_FREQUENCY_LABELS,
  MEDICINE_TIMING_LABELS,
  useMedicines,
} from '@nalvita/data';
import Pill from 'lucide-react-native/icons/pill';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { EmptyState, StatusBadge } from '@/components/ui';
import { radius, spacing, typeScale, useTheme } from '@/lib/theme';

type Tab = 'active' | 'past';

export function MedicinesScreen() {
  const theme = useTheme();
  const { data, isPending, isError } = useMedicines();
  const [tab, setTab] = useState<Tab>('active');

  const all = data ?? [];
  const shown = all.filter((medicine) =>
    tab === 'active' ? !isMedicinePast(medicine) : isMedicinePast(medicine),
  );

  return (
    <Screen title="Medicines" subtitle="What you are taking, and when.">
      <View style={styles.tabs}>
        {(['active', 'past'] as Tab[]).map((value) => {
          const selected = value === tab;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setTab(value)}
              style={[
                styles.tab,
                {
                  backgroundColor: selected ? theme.colors.interactiveDefault : theme.colors.bgSurface,
                  borderColor: selected ? theme.colors.interactiveDefault : theme.colors.borderStrong,
                },
              ]}
            >
              <Text
                style={[
                  typeScale.label,
                  { color: selected ? theme.colors.textInverse : theme.colors.textSecondary },
                ]}
              >
                {value === 'active' ? 'Taking now' : 'Past'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isPending ? <ActivityIndicator color={theme.colors.interactiveDefault} /> : null}

      {isError ? (
        <Text style={[typeScale.body, { color: theme.status.critical.fg }]}>
          We could not load your medicines. Pull down to try again.
        </Text>
      ) : null}

      {!isPending && !isError && shown.length === 0 ? (
        <EmptyState
          icon={Pill}
          title={tab === 'active' ? 'Nothing being taken' : 'Nothing in the past'}
          description={
            tab === 'active'
              ? 'Medicines you are taking will appear here.'
              : 'Medicines you have stopped will appear here.'
          }
        />
      ) : null}

      {shown.map((medicine) => (
        <MedicineCard key={medicine.id} medicine={medicine} />
      ))}
    </Screen>
  );
}

function MedicineCard({ medicine }: Readonly<{ medicine: Medicine }>) {
  const theme = useTheme();
  const timings = medicine.timings.map((t) => MEDICINE_TIMING_LABELS[t]).join(', ');

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderDefault },
      ]}
    >
      <View style={styles.cardHead}>
        <Text style={[typeScale.heading3, styles.name, { color: theme.colors.textPrimary }]}>
          {medicine.name}
        </Text>
        {isRefillDue(medicine) ? <StatusBadge variant="high">Refill due</StatusBadge> : null}
      </View>

      <Text style={[typeScale.body, { color: theme.colors.textSecondary }]}>
        {medicine.dosage} · {MEDICINE_FREQUENCY_LABELS[medicine.frequency]}
      </Text>

      {timings ? (
        <Text style={[typeScale.caption, { color: theme.colors.textMuted }]}>{timings}</Text>
      ) : null}

      <Text style={[typeScale.caption, { color: theme.colors.textMuted }]}>
        {medicine.end_date
          ? `${formatMedDate(medicine.start_date)} — ${formatMedDate(medicine.end_date)}`
          : `Since ${formatMedDate(medicine.start_date)}`}
        {medicine.doctor_name ? ` · ${medicine.doctor_name}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: spacing.sm },
  tab: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: { flexShrink: 1 },
});
