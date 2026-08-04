import {
  conditionInsertSchema,
  conditionSchema,
  type Condition,
  type ConditionStatus,
} from '@nalvita/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { auditedInvalidate, deleteAuditedRecord } from '@/lib/audit';
import { supabase } from '@/lib/supabase';

const conditionListSchema = z.array(conditionSchema);

/** User-facing names for each status (DB values are lowercase). */
export const CONDITION_STATUS_LABELS: Record<ConditionStatus, string> = {
  active: 'Active',
  managed: 'Managed',
  resolved: 'Resolved',
};

/** The fields a person fills in on the condition form. */
export interface ConditionFormValues {
  name: string;
  diagnosis_date: string | null;
  doctor_name: string | null;
  status: ConditionStatus;
  notes: string | null;
}

/** Formats a YYYY-MM-DD date for display, parsed as a local calendar date. */
export function formatConditionDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** The signed-in user's conditions, newest first. */
export function useConditions() {
  return useQuery({
    queryKey: ['conditions'],
    queryFn: async (): Promise<Condition[]> => {
      const { data, error } = await supabase
        .from('conditions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return conditionListSchema.parse(data);
    },
  });
}

function toRow(values: ConditionFormValues) {
  return {
    name: values.name.trim(),
    diagnosis_date: values.diagnosis_date || null,
    doctor_name: values.doctor_name?.trim() || null,
    status: values.status,
    notes: values.notes?.trim() || null,
  };
}

/** Adds a new condition; status defaults to active. */
export function useAddCondition(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: ConditionFormValues): Promise<Condition> => {
      const insert = conditionInsertSchema.parse(toRow(values));
      const { data, error } = await supabase
        .from('conditions')
        .insert({ ...insert, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return conditionSchema.parse(data);
    },
    onSuccess: auditedInvalidate(queryClient, 'added', 'conditions'),
  });
}

/** Edits an existing condition. */
export function useUpdateCondition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: ConditionFormValues;
    }): Promise<Condition> => {
      const { data, error } = await supabase
        .from('conditions')
        .update(toRow(values))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return conditionSchema.parse(data);
    },
    onSuccess: auditedInvalidate(queryClient, 'updated', 'conditions'),
  });
}

/** Deletes a condition. */
export function useDeleteCondition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAuditedRecord('conditions', id),
    onSuccess: auditedInvalidate(queryClient, 'deleted', 'conditions'),
  });
}
