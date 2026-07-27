import type { Vital, VitalType } from '@nalvita/core';
import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { VITAL_TYPE_LABELS, VITAL_UNITS, vitalsInWindow } from '@/lib/vitals';

interface VitalChartProps {
  vitals: Vital[];
  type: VitalType;
  days: number;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function VitalChart({ vitals, type, days }: Readonly<VitalChartProps>) {
  const data = useMemo(
    () =>
      vitalsInWindow(vitals, type, days).map((v) => ({
        label: shortDate(v.measured_at),
        systolic: v.value_1,
        diastolic: v.value_2,
        value: v.value_1,
      })),
    [vitals, type, days],
  );

  if (data.length === 0) {
    return (
      <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No readings in the last {days} days. Log one to start your chart.
      </p>
    );
  }

  const isBloodPressure = type === 'blood_pressure';

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="label" fontSize={12} />
          <YAxis fontSize={12} width={40} unit="" />
          <Tooltip formatter={(value) => `${value} ${VITAL_UNITS[type]}`} />
          {isBloodPressure ? (
            <>
              <Legend />
              <Line
                type="monotone"
                dataKey="systolic"
                name="Systolic"
                stroke="#dc2626"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
              <Line
                type="monotone"
                dataKey="diastolic"
                name="Diastolic"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
            </>
          ) : (
            <Line
              type="monotone"
              dataKey="value"
              name={VITAL_TYPE_LABELS[type]}
              stroke="#0f6e56"
              strokeWidth={2}
              dot={{ r: 2 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
