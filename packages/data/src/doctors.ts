import { doctorInsertSchema, doctorSchema, type Doctor } from '@nalvita/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { auditedInvalidate, deleteAuditedRecord } from './audit.js';
import { useActiveProfile } from './active-profile-context.js';
import { useSupabase } from './client.js';

const doctorListSchema = z.array(doctorSchema);

/** The fields a person fills in on the doctor form. */
export interface DoctorFormValues {
  name: string;
  specialty: string | null;
  hospital: string | null;
  phone: string | null;
  email: string | null;
}

/** The active profile's doctors, newest first. */
export function useDoctors() {
  const supabase = useSupabase();
  const { profileId } = useActiveProfile();
  return useQuery({
    queryKey: ['doctors', profileId],
    enabled: Boolean(profileId),
    queryFn: async (): Promise<Doctor[]> => {
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return doctorListSchema.parse(data);
    },
  });
}

function toRow(values: DoctorFormValues) {
  return {
    name: values.name.trim(),
    specialty: values.specialty?.trim() || null,
    hospital: values.hospital?.trim() || null,
    phone: values.phone?.trim() || null,
    email: values.email?.trim() || null,
  };
}

/** Adds a new doctor. */
export function useAddDoctor(profileId: string) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: DoctorFormValues): Promise<Doctor> => {
      const insert = doctorInsertSchema.parse(toRow(values));
      const { data, error } = await supabase
        .from('doctors')
        .insert({ ...insert, profile_id: profileId })
        .select()
        .single();
      if (error) throw error;
      return doctorSchema.parse(data);
    },
    onSuccess: auditedInvalidate(supabase, queryClient, 'added', 'doctors'),
  });
}

/** Edits an existing doctor. */
export function useUpdateDoctor() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: DoctorFormValues;
    }): Promise<Doctor> => {
      const { data, error } = await supabase
        .from('doctors')
        .update(toRow(values))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return doctorSchema.parse(data);
    },
    onSuccess: auditedInvalidate(supabase, queryClient, 'updated', 'doctors'),
  });
}

/** Deletes a doctor. */
export function useDeleteDoctor() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAuditedRecord(supabase, 'doctors', id),
    onSuccess: auditedInvalidate(supabase, queryClient, 'deleted', 'doctors'),
  });
}
