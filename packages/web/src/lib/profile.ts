import {
  profileSchema,
  profileUpdateSchema,
  type Gender,
  type Profile,
  type ProfileUpdate,
} from '@nalvita/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/** User-facing names for each gender (DB values are snake_case). */
export const GENDER_LABELS: Record<Gender, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
};

/** Whole years from a YYYY-MM-DD date of birth to today, or null if unknown. */
export function computeAge(dateOfBirth: string | null, today = new Date()): number | null {
  if (dateOfBirth === null) return null;
  const born = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(born.getTime())) return null;
  let age = today.getFullYear() - born.getFullYear();
  const monthDiff = today.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < born.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

/** Formats a YYYY-MM-DD date for display, parsed as a local calendar date. */
export function formatProfileDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** The signed-in user's own profile row (auto-created at signup by a DB trigger). */
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId as string)
        .single();
      if (error) throw error;
      return profileSchema.parse(data);
    },
  });
}

export function useUpdateProfile(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (update: ProfileUpdate): Promise<Profile> => {
      const payload = profileUpdateSchema.parse(update);
      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw error;
      return profileSchema.parse(data);
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(['profile', userId], profile);
    },
  });
}

/** A profile counts as complete once the person has told us their name. */
export function isProfileComplete(profile: Profile) {
  return profile.full_name !== null;
}
