import {
  medicineInsertSchema,
  medicineSchema,
  type Medicine,
  type MedicineFrequency,
  type MedicineTiming,
} from '@nalvita/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { auditRecord } from '@/lib/audit';
import { supabase } from '@/lib/supabase';

/** Show a refill reminder once the refill date is this many days away (or overdue). */
const REFILL_WINDOW_DAYS = 3;

const medicineListSchema = z.array(medicineSchema);

/** User-facing names for each schedule (DB values are snake_case). */
export const MEDICINE_FREQUENCY_LABELS: Record<MedicineFrequency, string> = {
  once_daily: 'Once a day',
  twice_daily: 'Twice a day',
  thrice_daily: 'Three times a day',
  as_needed: 'As needed',
};

export const MEDICINE_TIMING_LABELS: Record<MedicineTiming, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  night: 'Night',
};

/** The fields a person fills in on the medicine form. */
export interface MedicineFormValues {
  name: string;
  dosage: string;
  frequency: MedicineFrequency;
  timings: MedicineTiming[];
  doctor_name: string | null;
  start_date: string;
  end_date: string | null;
  refill_date: string | null;
  notes: string | null;
}

/** Today as YYYY-MM-DD, matching the date columns' calendar-day granularity. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Whole days from `fromIso` to `toIso` (negative if `toIso` is in the past). */
function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00`).getTime();
  const to = new Date(`${toIso}T00:00:00`).getTime();
  return Math.round((to - from) / 86_400_000);
}

/**
 * A medicine belongs in "Past" once it's marked stopped or its end date has
 * passed — the latter lets short courses move themselves without a cron job.
 */
export function isMedicinePast(medicine: Medicine, today = todayIso()): boolean {
  if (medicine.status === 'stopped') return true;
  return medicine.end_date !== null && medicine.end_date < today;
}

/** An active medicine is "refill due" when its refill date is near or overdue. */
export function isRefillDue(medicine: Medicine, today = todayIso()): boolean {
  if (medicine.refill_date === null) return false;
  if (isMedicinePast(medicine, today)) return false;
  return daysBetween(today, medicine.refill_date) <= REFILL_WINDOW_DAYS;
}

/** Formats a YYYY-MM-DD date for display, parsed as a local calendar date. */
export function formatMedDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** The signed-in user's medicines, newest first. */
export function useMedicines() {
  return useQuery({
    queryKey: ['medicines'],
    queryFn: async (): Promise<Medicine[]> => {
      const { data, error } = await supabase
        .from('medicines')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return medicineListSchema.parse(data);
    },
  });
}

function toRow(values: MedicineFormValues) {
  return {
    name: values.name.trim(),
    dosage: values.dosage.trim(),
    frequency: values.frequency,
    timings: values.timings,
    doctor_name: values.doctor_name?.trim() || null,
    start_date: values.start_date,
    end_date: values.end_date || null,
    refill_date: values.refill_date || null,
    notes: values.notes?.trim() || null,
  };
}

/** Adds a new medicine; status defaults to active. */
export function useAddMedicine(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: MedicineFormValues): Promise<Medicine> => {
      const insert = medicineInsertSchema.parse(toRow(values));
      const { data, error } = await supabase
        .from('medicines')
        .insert({ ...insert, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return medicineSchema.parse(data);
    },
    onSuccess: (medicine) => {
      auditRecord('added', 'medicines', medicine);
      return queryClient.invalidateQueries({ queryKey: ['medicines'] });
    },
  });
}

/** Edits an existing medicine's details. */
export function useUpdateMedicine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: MedicineFormValues;
    }): Promise<Medicine> => {
      const { data, error } = await supabase
        .from('medicines')
        .update(toRow(values))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return medicineSchema.parse(data);
    },
    onSuccess: (medicine) => {
      auditRecord('updated', 'medicines', medicine);
      return queryClient.invalidateQueries({ queryKey: ['medicines'] });
    },
  });
}

/** Marks an active medicine as stopped, recording the day it ended. */
export function useStopMedicine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, endDate }: { id: string; endDate: string }): Promise<Medicine> => {
      const { data, error } = await supabase
        .from('medicines')
        .update({ status: 'stopped', end_date: endDate })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return medicineSchema.parse(data);
    },
    onSuccess: (medicine) => {
      auditRecord('updated', 'medicines', medicine);
      return queryClient.invalidateQueries({ queryKey: ['medicines'] });
    },
  });
}
