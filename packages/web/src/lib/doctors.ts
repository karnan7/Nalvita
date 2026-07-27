import { doctorInsertSchema, doctorSchema, type Doctor } from '@nalvita/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { supabase } from '@/lib/supabase';

const doctorListSchema = z.array(doctorSchema);

/** The fields a person fills in on the doctor form. */
export interface DoctorFormValues {
  name: string;
  specialty: string | null;
  hospital: string | null;
  phone: string | null;
  email: string | null;
}

/** The signed-in user's doctors, newest first. */
export function useDoctors() {
  return useQuery({
    queryKey: ['doctors'],
    queryFn: async (): Promise<Doctor[]> => {
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
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
export function useAddDoctor(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: DoctorFormValues): Promise<Doctor> => {
      const insert = doctorInsertSchema.parse(toRow(values));
      const { data, error } = await supabase
        .from('doctors')
        .insert({ ...insert, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return doctorSchema.parse(data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doctors'] }),
  });
}

/** Edits an existing doctor. */
export function useUpdateDoctor() {
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doctors'] }),
  });
}

/** Deletes a doctor. */
export function useDeleteDoctor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('doctors').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doctors'] }),
  });
}
