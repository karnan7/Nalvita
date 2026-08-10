import {
  getVitalStatus,
  vitalInsertSchema,
  vitalSchema,
  type Vital,
  type VitalStatus,
  type VitalType,
} from '@nalvita/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { auditedInvalidate, deleteAuditedRecord } from './audit.js';
import { useActiveProfile } from './active-profile-context.js';
import { useSupabase } from './client.js';

const vitalListSchema = z.array(vitalSchema);

/** User-facing names for each vital type (DB values are snake_case). */
export const VITAL_TYPE_LABELS: Record<VitalType, string> = {
  blood_pressure: 'Blood pressure',
  blood_sugar_fasting: 'Blood sugar (fasting)',
  blood_sugar_post_meal: 'Blood sugar (post-meal)',
  weight: 'Weight',
  heart_rate: 'Heart rate',
};

/** Unit each vital type is recorded in. */
export const VITAL_UNITS: Record<VitalType, string> = {
  blood_pressure: 'mmHg',
  blood_sugar_fasting: 'mg/dL',
  blood_sugar_post_meal: 'mg/dL',
  weight: 'kg',
  heart_rate: 'bpm',
};

/** Plain-language label for each status badge. */
export const VITAL_STATUS_LABELS: Record<VitalStatus, string> = {
  normal: 'Normal',
  borderline: 'Borderline',
  high: 'High',
  low: 'Low',
};

export function statusOf(vital: Vital): VitalStatus {
  return getVitalStatus(vital.type, vital.value_1, vital.value_2);
}

/** The reading value as a person would read it — "120/80" for BP, else the number. */
export function formatVitalValue(vital: Pick<Vital, 'type' | 'value_1' | 'value_2'>): string {
  if (vital.type === 'blood_pressure') return `${vital.value_1}/${vital.value_2 ?? '—'}`;
  return `${vital.value_1}`;
}

/** A reading's date and time for display, in the viewer's local timezone. */
export function formatMeasuredAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Turns a `datetime-local` value (local wall-clock) into an ISO string with offset. */
export function measuredAtFromLocal(local: string): string {
  return new Date(local).toISOString();
}

/** An ISO instant as the `datetime-local` input expects it (local wall-clock, no zone). */
export function localFromMeasuredAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Readings of one type within the last `days`, oldest first (for the chart). */
export function vitalsInWindow(vitals: Vital[], type: VitalType, days: number): Vital[] {
  const cutoff = Date.now() - days * 86_400_000;
  return vitals
    .filter((v) => v.type === type && new Date(v.measured_at).getTime() >= cutoff)
    .sort((a, b) => a.measured_at.localeCompare(b.measured_at));
}

/** The fields a person fills in on the log-vitals form. */
export interface VitalFormValues {
  type: VitalType;
  value_1: number;
  value_2: number | null;
  measured_at: string;
  notes: string | null;
}

function toRow(values: VitalFormValues) {
  return {
    type: values.type,
    value_1: values.value_1,
    value_2: values.type === 'blood_pressure' ? values.value_2 : null,
    unit: VITAL_UNITS[values.type],
    measured_at: values.measured_at,
    notes: values.notes?.trim() || null,
  };
}

/** The active profile's vitals, newest first. */
export function useVitals() {
  const supabase = useSupabase();
  const { profileId } = useActiveProfile();
  return useQuery({
    queryKey: ['vitals', profileId],
    enabled: Boolean(profileId),
    queryFn: async (): Promise<Vital[]> => {
      const { data, error } = await supabase
        .from('vitals')
        .select('*')
        .eq('profile_id', profileId)
        .order('measured_at', { ascending: false });
      if (error) throw error;
      return vitalListSchema.parse(data);
    },
  });
}

/** Logs a new reading. */
export function useLogVital(profileId: string) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: VitalFormValues): Promise<Vital> => {
      const insert = vitalInsertSchema.parse(toRow(values));
      const { data, error } = await supabase
        .from('vitals')
        .insert({ ...insert, profile_id: profileId })
        .select()
        .single();
      if (error) throw error;
      return vitalSchema.parse(data);
    },
    onSuccess: auditedInvalidate(supabase, queryClient, 'added', 'vitals'),
  });
}

/** Corrects an existing reading. */
export function useUpdateVital() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: VitalFormValues;
    }): Promise<Vital> => {
      const { data, error } = await supabase
        .from('vitals')
        .update(toRow(values))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return vitalSchema.parse(data);
    },
    onSuccess: auditedInvalidate(supabase, queryClient, 'updated', 'vitals'),
  });
}

/** Removes a wrongly entered reading. */
export function useDeleteVital() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAuditedRecord(supabase, 'vitals', id),
    onSuccess: auditedInvalidate(supabase, queryClient, 'deleted', 'vitals'),
  });
}
