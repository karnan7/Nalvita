import {
  allergyInsertSchema,
  allergySchema,
  type Allergy,
  type AllergySeverity,
} from '@nalvita/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { auditedInvalidate, deleteAuditedRecord } from '@/lib/audit';
import { supabase } from '@/lib/supabase';

const allergyListSchema = z.array(allergySchema);

/** User-facing names for each severity (DB values are lowercase). */
export const ALLERGY_SEVERITY_LABELS: Record<AllergySeverity, string> = {
  mild: 'Mild',
  moderate: 'Moderate',
  severe: 'Severe',
};

/** Most-serious first — drives banner ordering and badge colour. */
const SEVERITY_RANK: Record<AllergySeverity, number> = {
  severe: 0,
  moderate: 1,
  mild: 2,
};

/** Allergies sorted most-serious first, so the scariest ones lead the banner. */
export function sortBySeverity(allergies: readonly Allergy[]): Allergy[] {
  return [...allergies].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/** The fields a person fills in on the allergy form. */
export interface AllergyFormValues {
  allergen: string;
  severity: AllergySeverity;
  reaction: string | null;
}

/** The signed-in user's allergies, newest first. */
export function useAllergies() {
  return useQuery({
    queryKey: ['allergies'],
    queryFn: async (): Promise<Allergy[]> => {
      const { data, error } = await supabase
        .from('allergies')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return allergyListSchema.parse(data);
    },
  });
}

function toRow(values: AllergyFormValues) {
  return {
    allergen: values.allergen.trim(),
    severity: values.severity,
    reaction: values.reaction?.trim() || null,
  };
}

/** Adds a new allergy. */
export function useAddAllergy(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: AllergyFormValues): Promise<Allergy> => {
      const insert = allergyInsertSchema.parse(toRow(values));
      const { data, error } = await supabase
        .from('allergies')
        .insert({ ...insert, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return allergySchema.parse(data);
    },
    onSuccess: auditedInvalidate(queryClient, 'added', 'allergies'),
  });
}

/** Edits an existing allergy. */
export function useUpdateAllergy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: AllergyFormValues;
    }): Promise<Allergy> => {
      const { data, error } = await supabase
        .from('allergies')
        .update(toRow(values))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return allergySchema.parse(data);
    },
    onSuccess: auditedInvalidate(queryClient, 'updated', 'allergies'),
  });
}

/** Deletes an allergy. */
export function useDeleteAllergy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAuditedRecord('allergies', id),
    onSuccess: auditedInvalidate(queryClient, 'deleted', 'allergies'),
  });
}
