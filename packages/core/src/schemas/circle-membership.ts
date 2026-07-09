import { z } from 'zod';
import { CIRCLE_ROLES, MEMBERSHIP_STATUSES, SHARE_CATEGORIES } from '../constants.js';
import { isoDateTime } from './shared.js';

/** A Health Circle membership: one owner↔member pair with a role. */
export const circleMembershipSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  member_id: z.string().uuid(),
  role: z.enum(CIRCLE_ROLES),
  shared_categories: z.array(z.enum(SHARE_CATEGORIES)).nonempty(),
  status: z.enum(MEMBERSHIP_STATUSES),
  invited_at: isoDateTime,
  accepted_at: isoDateTime.nullable(),
  revoked_at: isoDateTime.nullable(),
});

export type CircleMembership = z.infer<typeof circleMembershipSchema>;

/**
 * Payload for inviting a member; owner_id comes from the session, status
 * starts as pending. Defaults match the `circle_memberships` columns.
 */
export const circleMembershipInviteSchema = z.object({
  member_id: z.string().uuid(),
  role: z.enum(CIRCLE_ROLES).default('viewer'),
  shared_categories: z.array(z.enum(SHARE_CATEGORIES)).nonempty().default(['all']),
});

export type CircleMembershipInvite = z.infer<typeof circleMembershipInviteSchema>;
