import {
  circleInviteInsertSchema,
  circleInvitePreviewSchema,
  circleInviteSummarySchema,
  circlePersonSchema,
  type CirclePerson,
  type CircleRole,
  type ShareCategory,
} from '@nalvita/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { useActiveProfile } from '@/lib/active-profile-context';
import { newSecretPair } from '@/lib/secrets';
import { supabase } from '@/lib/supabase';

const peopleListSchema = z.array(circlePersonSchema);
const inviteListSchema = z.array(circleInviteSummarySchema);

/** Plain-language role names for the invite form and consent screen. */
export const CIRCLE_ROLE_LABELS: Record<CircleRole, string> = {
  viewer: 'Can view',
  caregiver: 'Can view and add',
  manager: 'Full access',
};

/** What each role lets the person actually do, in non-technical words. */
export const CIRCLE_ROLE_DESCRIPTIONS: Record<CircleRole, string> = {
  viewer: 'See the records you share, but not change anything.',
  caregiver: 'See the records you share and add new entries on your behalf.',
  manager: 'See, add, and remove records — full help with a shared account.',
};

/** Categories an owner can choose to share (excludes the 'all' wildcard). */
export const SHAREABLE_CATEGORIES = [
  'documents',
  'medicines',
  'vitals',
  'conditions',
  'allergies',
  'doctors',
] as const satisfies readonly ShareCategory[];

export const SHARE_CATEGORY_LABELS: Record<ShareCategory, string> = {
  all: 'All records',
  profiles: 'Profile',
  documents: 'Documents',
  medicines: 'Medicines',
  vitals: 'Vitals',
  conditions: 'Conditions',
  allergies: 'Allergies',
  doctors: 'Doctors',
};

/** Human list of shared categories, e.g. "Medicines, Vitals and Documents". */
export function describeCategories(categories: readonly ShareCategory[]): string {
  if (categories.includes('all')) return 'all your records';
  const labels = categories.map((c) => SHARE_CATEGORY_LABELS[c]);
  if (labels.length <= 1) return labels[0] ?? '';
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/**
 * What the person viewing may do in the account they are looking at. A null
 * membership means it is their own account, where everything is allowed.
 *
 * These gate the UI so people are not offered actions the database would
 * refuse — RLS remains the thing that actually enforces them.
 */
export function allowsCategory(
  viewing: CirclePerson | null,
  category: ShareCategory,
): boolean {
  if (!viewing) return true;
  const shared = viewing.shared_categories;
  return shared.includes('all') || shared.includes(category);
}

/** Adding and editing records needs caregiver or manager. */
export function allowsWrite(viewing: CirclePerson | null): boolean {
  return viewing === null || viewing.role === 'caregiver' || viewing.role === 'manager';
}

/** Deleting records needs manager. */
export function allowsDelete(viewing: CirclePerson | null): boolean {
  return viewing === null || viewing.role === 'manager';
}

/**
 * What the current screen may offer, given whose records are open. Pages use
 * this to hide actions rather than let people try them and be refused.
 */
export function useRecordPermissions() {
  const { viewing, guardWrite } = useActiveProfile();
  return {
    canWrite: allowsWrite(viewing),
    canDelete: allowsDelete(viewing),
    /** Wraps an action so the first write into someone else's account is confirmed. */
    guardWrite,
  };
}

/** What one person in a circle is allowed to do, as the access form models it. */
export interface AccessSelection {
  role: CircleRole;
  categories: ShareCategory[];
}

/** Whether a selection is complete enough to save — sharing nothing is not access. */
export function isValidSelection(value: AccessSelection): boolean {
  return value.categories.length > 0;
}

/** Applies "share everything" as a single wildcard rather than every box ticked. */
export function toggleAllCategories(value: AccessSelection): AccessSelection {
  const shareAll = value.categories.includes('all');
  return { ...value, categories: shareAll ? [] : ['all'] };
}

/** Ticking a specific category clears the wildcard, so the two never disagree. */
export function toggleCategory(value: AccessSelection, category: ShareCategory): AccessSelection {
  const withoutAll: ShareCategory[] = value.categories.filter((c) => c !== 'all');
  const categories = withoutAll.includes(category)
    ? withoutAll.filter((c) => c !== category)
    : [...withoutAll, category];
  return { ...value, categories };
}

const PEOPLE_KEY = ['circle-people'];
const INVITES_KEY = ['circle-invites'];

/** The join URL an owner shares; the secret lives in the query string. */
export function inviteLink(token: string): string {
  return `${window.location.origin}/family/join?token=${token}`;
}

export interface InviteFormValues {
  role: CircleRole;
  categories: ShareCategory[];
  invitee_email: string;
}

export interface CreatedInvite {
  code: string;
  link: string;
}

/** Everyone connected to me, in both directions, with their display name. */
export function useCirclePeople() {
  return useQuery({
    queryKey: PEOPLE_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_circle_people');
      if (error) throw error;
      return peopleListSchema.parse(data ?? []);
    },
  });
}

/** The owner's still-open invites (never exposes the secret hashes). */
export function usePendingInvites() {
  return useQuery({
    queryKey: INVITES_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('circle_invites')
        .select(
          'id,owner_id,invitee_email,requested_role,requested_categories,status,expires_at,created_at,responded_at',
        )
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return inviteListSchema.parse(data);
    },
  });
}

/**
 * Creates an invite: generates the secrets, stores only their hashes, and
 * returns the plaintext code + link to show the owner once. Re-inviting the
 * same email replaces the earlier pending invite instead of stacking.
 */
export function useCreateInvite(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: InviteFormValues): Promise<CreatedInvite> => {
      const { token, code, token_hash, code_hash } = await newSecretPair();
      const email = values.invitee_email.trim() || null;

      if (email) {
        await supabase
          .from('circle_invites')
          .delete()
          .eq('owner_id', userId)
          .eq('status', 'pending')
          .ilike('invitee_email', email);
      }

      const insert = circleInviteInsertSchema.parse({
        token_hash,
        code_hash,
        invitee_email: email,
        requested_role: values.role,
        requested_categories: values.categories,
      });

      const { error } = await supabase
        .from('circle_invites')
        .insert({ ...insert, owner_id: userId })
        .select('id')
        .single();
      if (error) throw error;

      return { code, link: inviteLink(token) };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVITES_KEY }),
  });
}

/** Cancels a pending invite the owner no longer wants outstanding. */
export function useCancelInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string): Promise<void> => {
      const { error } = await supabase.from('circle_invites').delete().eq('id', inviteId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVITES_KEY }),
  });
}

export interface MembershipChange {
  membershipId: string;
  role: CircleRole;
  categories: ShareCategory[];
}

/**
 * Changes what a member can do and see. Both directions take effect on the next
 * request — RLS reads the membership row on every check, so a downgrade needs
 * no re-consent and no session refresh.
 */
export function useUpdateMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ membershipId, role, categories }: MembershipChange): Promise<void> => {
      const { error } = await supabase
        .from('circle_memberships')
        .update({ role, shared_categories: categories })
        .eq('id', membershipId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PEOPLE_KEY }),
  });
}

/** Ends a member's access immediately (membership → revoked, kept as history). */
export function useRevokeMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (membershipId: string): Promise<void> => {
      const { error } = await supabase
        .from('circle_memberships')
        .update({ status: 'revoked' })
        .eq('id', membershipId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PEOPLE_KEY }),
  });
}

/** Reads the consent details for a secret (link token or typed code). */
export function useInvitePreview(secret: string | null) {
  return useQuery({
    queryKey: ['invite-preview', secret],
    enabled: Boolean(secret),
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('preview_circle_invite', { p_secret: secret });
      if (error) throw error;
      const rows = z.array(circleInvitePreviewSchema).parse(data ?? []);
      if (rows.length === 0) throw new Error('not-found');
      return rows[0];
    },
  });
}

/** Accepts an invite, creating an active membership for the current user. */
export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (secret: string): Promise<void> => {
      const { error } = await supabase.rpc('accept_circle_invite', { p_secret: secret });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PEOPLE_KEY }),
  });
}

/** Declines an invite; nothing is added to the circle. */
export function useDeclineInvite() {
  return useMutation({
    mutationFn: async (secret: string): Promise<void> => {
      const { error } = await supabase.rpc('decline_circle_invite', { p_secret: secret });
      if (error) throw error;
    },
  });
}
