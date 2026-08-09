import {
  managedProfileInsertSchema,
  profileClaimInsertSchema,
  profileClaimPreviewSchema,
  profileClaimSummarySchema,
  profileSchema,
  MAX_MANAGED_PROFILES,
  type CirclePerson,
  type ManagedProfileInsert,
  type Profile,
} from '@nalvita/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { newSecretPair } from '@/lib/secrets';
import { supabase } from '@/lib/supabase';

const profileListSchema = z.array(profileSchema);
const claimListSchema = z.array(profileClaimSummarySchema);

export const MANAGED_KEY = ['managed-profiles'];
export const CLAIMS_KEY = ['profile-claims'];

/** The URL the person claiming their profile opens. */
export function claimLink(token: string): string {
  return `${window.location.origin}/profile/claim?token=${token}`;
}

/** How a managed profile is referred to before anyone has named it. */
export function managedName(profile: Pick<Profile, 'full_name'>): string {
  return profile.full_name?.trim() || 'Unnamed profile';
}

/** True once the account is looking after as many people as it may. */
export function isAtProfileCap(profiles: readonly Profile[] | undefined): boolean {
  return (profiles?.length ?? 0) >= MAX_MANAGED_PROFILES;
}

/** How many more profiles this account may take on. */
export function remainingProfileSlots(profiles: readonly Profile[] | undefined): number {
  return Math.max(0, MAX_MANAGED_PROFILES - (profiles?.length ?? 0));
}

/**
 * A managed profile as the "viewing as" machinery understands it, so opening
 * one uses the same switch, the same cards and the same permission checks as
 * opening a family member's shared records.
 *
 * Every field says something true — a manager has full access to everything —
 * except `membership_id`, which carries the profile id because a managed
 * profile has no membership row to name. Nothing writes back through it: the
 * two mutations that take a membership id (change access, revoke) are only ever
 * given rows from `list_circle_people`.
 */
export function viewingManagedProfile(profile: Profile): CirclePerson {
  return {
    membership_id: profile.id,
    direction: 'member',
    counterpart_id: profile.id,
    counterpart_name: profile.full_name,
    role: 'manager',
    shared_categories: ['all'],
    status: 'active',
    accepted_at: profile.created_at,
    revoked_at: null,
  };
}

/** Everyone I look after who has no account of their own. */
export function useManagedProfiles(userId: string | undefined) {
  return useQuery({
    queryKey: [...MANAGED_KEY, userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('managed_by', userId as string)
        .is('user_id', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return profileListSchema.parse(data);
    },
  });
}

/**
 * Creates a profile for someone with no account. The cap is enforced by a
 * database trigger; this surfaces its message rather than pre-checking, so the
 * limit holds even if two tabs create a profile at once.
 */
export function useCreateManagedProfile(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: ManagedProfileInsert): Promise<Profile> => {
      const insert = managedProfileInsertSchema.parse(values);
      const { data, error } = await supabase
        .from('profiles')
        .insert({ ...insert, managed_by: userId })
        .select()
        .single();
      if (error) throw error;
      return profileSchema.parse(data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MANAGED_KEY }),
  });
}

/** Edits the details of a profile I look after. */
export function useUpdateManagedProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      profileId,
      values,
    }: {
      profileId: string;
      values: ManagedProfileInsert;
    }): Promise<Profile> => {
      const update = managedProfileInsertSchema.parse(values);
      const { data, error } = await supabase
        .from('profiles')
        .update(update)
        .eq('id', profileId)
        .select()
        .single();
      if (error) throw error;
      return profileSchema.parse(data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MANAGED_KEY }),
  });
}

/** Handovers I have started and not yet finished. */
export function useProfileClaims() {
  return useQuery({
    queryKey: CLAIMS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_profile_claims');
      if (error) throw error;
      return claimListSchema.parse(data ?? []);
    },
  });
}

export interface StartHandoverValues {
  profileId: string;
  invitee_email: string;
}

export interface CreatedClaim {
  code: string;
  link: string;
}

/**
 * Starts a handover: generates the secrets, stores only their hashes, and hands
 * back the plaintext code and link to show the manager once. Only one handover
 * can be live per profile, so an earlier unfinished one is cleared first.
 */
export function useStartHandover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: StartHandoverValues): Promise<CreatedClaim> => {
      const { token, code, token_hash, code_hash } = await newSecretPair();

      await supabase.from('profile_claims').delete().eq('profile_id', values.profileId);

      const insert = profileClaimInsertSchema.parse({
        profile_id: values.profileId,
        token_hash,
        code_hash,
        invitee_email: values.invitee_email.trim() || null,
      });

      const { error } = await supabase.from('profile_claims').insert(insert).select('id').single();
      if (error) throw error;

      return { code, link: claimLink(token) };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAIMS_KEY }),
  });
}

/** Withdraws a handover nobody has claimed yet. */
export function useCancelHandover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (claimId: string): Promise<void> => {
      const { error } = await supabase.from('profile_claims').delete().eq('id', claimId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAIMS_KEY }),
  });
}

/**
 * The manager's confirmation — the last step. Transfers the profile to the
 * account that claimed it and leaves the manager with caregiver access.
 */
export function useConfirmHandover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (claimId: string): Promise<void> => {
      const { error } = await supabase.rpc('complete_profile_claim', { p_claim: claimId });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CLAIMS_KEY }),
        queryClient.invalidateQueries({ queryKey: MANAGED_KEY }),
        queryClient.invalidateQueries({ queryKey: ['circle-people'] }),
      ]);
    },
  });
}

/** The manager's other answer: not this person. The profile stays with them. */
export function useRejectHandover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (claimId: string): Promise<void> => {
      const { error } = await supabase.rpc('reject_profile_claim', { p_claim: claimId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAIMS_KEY }),
  });
}

/** What the person holding a claim link is being offered. */
export function useClaimPreview(secret: string | null) {
  return useQuery({
    queryKey: ['claim-preview', secret],
    enabled: Boolean(secret),
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('preview_profile_claim', { p_secret: secret });
      if (error) throw error;
      const rows = z.array(profileClaimPreviewSchema).parse(data ?? []);
      if (rows.length === 0) throw new Error('not-found');
      return rows[0];
    },
  });
}

/** The claimant's consent. Nothing moves until the manager confirms as well. */
export function useAcceptClaim() {
  return useMutation({
    mutationFn: async (secret: string): Promise<void> => {
      const { error } = await supabase.rpc('accept_profile_claim', { p_secret: secret });
      if (error) throw error;
    },
  });
}

/** The claimant says no; the profile stays exactly as it was. */
export function useDeclineClaim() {
  return useMutation({
    mutationFn: async (secret: string): Promise<void> => {
      const { error } = await supabase.rpc('decline_profile_claim', { p_secret: secret });
      if (error) throw error;
    },
  });
}
