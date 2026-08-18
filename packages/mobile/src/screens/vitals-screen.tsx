import { VITAL_TYPES, type VitalType } from '@nalvita/core';
import {
  formatMeasuredAt,
  formatVitalValue,
  useVitals,
  VITAL_TYPE_LABELS,
  VITAL_UNITS,
  vitalsInWindow,
} from '@nalvita/data';
import Activity from 'lucide-react-native/icons/activity';
import { useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Screen } from '@/components/screen';
import { EmptyState, SectionCard } from '@/components/ui';
import { VitalBadge } from '@/components/vital-badge';
import { VitalChart } from '@/components/vital-chart';
import { radius, spacing, typeScale, useTheme } from '@/lib/theme';

/** Windows offered for the trend, in days. */
const WINDOWS = [7, 30, 90] as const;

export function VitalsScreen() {
  const theme = useTheme();
  const { data, isPending, isError } = useVitals();
  const [type, setType] = useState<VitalType>('blood_pressure');
  const [days, setDays] = useState<number>(30);
  const [chartWidth, setChartWidth] = useState(0);

  const all = data ?? [];
  const inWindow = vitalsInWindow([...all], type, days);
  const history = all.filter((vital) => vital.type === type);

  function measure(event: LayoutChangeEvent) {
    setChartWidth(event.nativeEvent.layout.width);
  }

  return (
    <Screen title="Vitals" subtitle="Your readings over time.">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {VITAL_TYPES.map((value) => {
          const selected = value === type;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setType(value)}
              style={[
                styles.chip,
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
                {VITAL_TYPE_LABELS[value]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isPending ? <ActivityIndicator color={theme.colors.interactiveDefault} /> : null}

      {isError ? (
        <Text style={[typeScale.body, { color: theme.status.critical.fg }]}>
          We could not load your readings. Pull down to try again.
        </Text>
      ) : null}

      {!isPending && !isError ? (
        <SectionCard
          title={VITAL_TYPE_LABELS[type]}
          action={
            <View style={styles.windows}>
              {WINDOWS.map((value) => {
                const selected = value === days;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Last ${value} days`}
                    onPress={() => setDays(value)}
                  >
                    <Text
                      style={[
                        typeScale.caption,
                        {
                          color: selected
                            ? theme.colors.interactiveDefault
                            : theme.colors.textMuted,
                        },
                      ]}
                    >
                      {value}d
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          }
        >
          <View onLayout={measure}>
            {chartWidth > 0 ? (
              <VitalChart vitals={inWindow} type={type} width={chartWidth} />
            ) : null}
          </View>
        </SectionCard>
      ) : null}

      {!isPending && !isError && history.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No readings yet"
          description={`${VITAL_TYPE_LABELS[type]} readings you log will appear here.`}
        />
      ) : null}

      {history.length > 0 ? (
        <SectionCard title="History">
          {history.map((vital) => (
            <View key={vital.id} style={styles.row}>
              <View style={styles.rowBody}>
                <Text style={[typeScale.body, { color: theme.colors.textPrimary }]}>
                  {formatVitalValue(vital)} {VITAL_UNITS[vital.type]}
                </Text>
                <Text style={[typeScale.caption, { color: theme.colors.textMuted }]}>
                  {formatMeasuredAt(vital.measured_at)}
                </Text>
              </View>
              <VitalBadge vital={vital} />
            </View>
          ))}
        </SectionCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: spacing.sm, paddingRight: spacing.md },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  windows: { flexDirection: 'row', gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowBody: { gap: 2, flexShrink: 1 },
});
