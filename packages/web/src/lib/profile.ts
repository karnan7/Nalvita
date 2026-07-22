import {
  profileSchema,
  profileUpdateSchema,
  type Profile,
  type ProfileUpdate,
} from '@nalvita/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

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
