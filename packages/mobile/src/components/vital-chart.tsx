import type { Vital, VitalType } from '@nalvita/core';
import { formatVitalValue, VITAL_UNITS, vitalStatusVariant } from '@nalvita/data';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { spacing, typeScale, useTheme } from '@/lib/theme';

const HEIGHT = 160;
const PADDING = { top: 12, right: 8, bottom: 22, left: 8 };

/**
 * A reading's trend over time, drawn by hand.
 *
 * The web app uses Recharts, which is DOM-only. Rather than take on a native
 * charting library for what is a line and some dots, this draws with
 * `react-native-svg` — already present for the icons. It also keeps each point
 * coloured by its own clinical status, which a generic chart library fights.
 */
export function VitalChart({
  vitals,
  type,
  width,
}: Readonly<{ vitals: readonly Vital[]; type: VitalType; width: number }>) {
  const theme = useTheme();

  // Oldest first, so the line reads left-to-right as time passing.
  const points = [...vitals].sort(
    (a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime(),
  );

  if (points.length === 0) {
    return (
      <Text style={[typeScale.body, { color: theme.colors.textMuted }]}>
        No readings in this period.
      </Text>
    );
  }

  const values = points.map((v) => v.value_1);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series would divide by zero; give it a band so the line sits mid-height.
  const span = max - min || Math.max(1, Math.abs(max) * 0.1);

  const plotWidth = Math.max(1, width - PADDING.left - PADDING.right);
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const xFor = (index: number) =>
    PADDING.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const yFor = (value: number) => PADDING.top + plotHeight - ((value - min) / span) * plotHeight;

  const polyline = points.map((v, i) => `${xFor(i)},${yFor(v.value_1)}`).join(' ');
  const latest = points[points.length - 1];

  return (
    <View style={styles.root}>
      <Svg width={width} height={HEIGHT} accessibilityLabel={`Trend over ${points.length} readings`}>
        {/* Baseline, so a single reading still has something to sit on. */}
        <Line
          x1={PADDING.left}
          y1={PADDING.top + plotHeight}
          x2={PADDING.left + plotWidth}
          y2={PADDING.top + plotHeight}
          stroke={theme.colors.borderSubtle}
          strokeWidth={1}
        />
        {points.length > 1 ? (
          <Polyline
            points={polyline}
            fill="none"
            stroke={theme.colors.interactiveDefault}
            strokeWidth={2}
          />
        ) : null}
        {points.map((vital, index) => {
          const variant = vitalStatusVariant(vital);
          return (
            <Circle
              key={vital.id}
              cx={xFor(index)}
              cy={yFor(vital.value_1)}
              r={4}
              fill={variant ? theme.status[variant].fg : theme.colors.interactiveDefault}
            />
          );
        })}
      </Svg>

      <View style={styles.footer}>
        <Text style={[typeScale.caption, { color: theme.colors.textMuted }]}>
          {points.length} reading{points.length === 1 ? '' : 's'}
        </Text>
        {latest ? (
          <Text style={[typeScale.caption, { color: theme.colors.textSecondary }]}>
            Latest {formatVitalValue(latest)} {VITAL_UNITS[type]}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
});
