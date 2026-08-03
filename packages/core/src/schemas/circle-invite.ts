import { z } from 'zod';
import { CIRCLE_ROLES, INVITE_STATUSES, MEMBERSHIP_STATUSES, SHARE_CATEGORIES } from '../constants.js';
import { isoDateTime } from './shared.js';

/**
 * A Health Circle invite: a code/link an owner sends so someone can join their
 * circle with a chosen role and categories. Only hashes of the secrets are
 * stored; the plaintext lives only in the code and link shown to the owner once.
 */
export const circleInviteSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  token_hash: z.string().min(1),
  code_hash: z.string().min(1),
  invitee_email: z.string().email().nullable(),
  requested_role: z.enum(CIRCLE_ROLES),
  requested_categories: z.array(z.enum(SHARE_CATEGORIES)).nonempty(),
  status: z.enum(INVITE_STATUSES),
  expires_at: isoDateTime,
  created_at: isoDateTime,
  responded_at: isoDateTime.nullable(),
});

export type CircleInvite = z.infer<typeof circleInviteSchema>;

/**
 * What the owner reads for their pending-invites list: never the secret hashes.
 */
export const circleInviteSummarySchema = circleInviteSchema.omit({
  token_hash: true,
  code_hash: true,
});

export type CircleInviteSummary = z.infer<typeof circleInviteSummarySchema>;

/**
 * Row written when creating an invite. The client generates the secrets and
 * stores only their hashes; owner_id comes from the session, status/expiry from
 * the column defaults.
 */
export const circleInviteInsertSchema = z.object({
  token_hash: z.string().min(1),
  code_hash: z.string().min(1),
  invitee_email: z.string().email().nullable().default(null),
  requested_role: z.enum(CIRCLE_ROLES).default('viewer'),
  requested_categories: z.array(z.enum(SHARE_CATEGORIES)).nonempty().default(['all']),
});

export type CircleInviteInsert = z.infer<typeof circleInviteInsertSchema>;

/** Consent-screen preview returned by the `preview_circle_invite` RPC. */
export const circleInvitePreviewSchema = z.object({
  owner_id: z.string().uuid(),
  owner_name: z.string().nullable(),
  requested_role: z.enum(CIRCLE_ROLES),
  requested_categories: z.array(z.enum(SHARE_CATEGORIES)).nonempty(),
  expires_at: isoDateTime,
});

export type CircleInvitePreview = z.infer<typeof circleInvitePreviewSchema>;

/** A connected person returned by the `list_circle_people` RPC, either direction. */
export const circlePersonSchema = z.object({
  membership_id: z.string().uuid(),
  direction: z.enum(['owner', 'member']),
  counterpart_id: z.string().uuid(),
  counterpart_name: z.string().nullable(),
  role: z.enum(CIRCLE_ROLES),
  shared_categories: z.array(z.enum(SHARE_CATEGORIES)).nonempty(),
  status: z.enum(MEMBERSHIP_STATUSES),
  accepted_at: isoDateTime.nullable(),
  revoked_at: isoDateTime.nullable(),
});

export type CirclePerson = z.infer<typeof circlePersonSchema>;
