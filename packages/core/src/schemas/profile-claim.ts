import { z } from 'zod';
import { CLAIM_STATUSES } from '../constants.js';
import { isoDate, isoDateTime } from './shared.js';

/**
 * A handover: the link by which someone takes over a profile that has been
 * managed for them.
 *
 * Only hashes of the two secrets are stored, as with circle invites — the
 * plaintext exists in the link and the code shown to the manager once. Unlike
 * an invite, a claim is answered twice: the person claiming consents, then the
 * manager confirms against a named account.
 */
export const profileClaimSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  manager_id: z.string().uuid(),
  token_hash: z.string().min(1),
  code_hash: z.string().min(1),
  invitee_email: z.string().email().nullable(),
  status: z.enum(CLAIM_STATUSES),
  claimed_by: z.string().uuid().nullable(),
  claimed_at: isoDateTime.nullable(),
  expires_at: isoDateTime,
  created_at: isoDateTime,
  responded_at: isoDateTime.nullable(),
});

export type ProfileClaim = z.infer<typeof profileClaimSchema>;

/**
 * Row written when a manager starts a handover. The client generates the
 * secrets and stores only their hashes; status and expiry come from the column
 * defaults.
 */
export const profileClaimInsertSchema = z.object({
  profile_id: z.string().uuid(),
  token_hash: z.string().min(1),
  code_hash: z.string().min(1),
  invitee_email: z.string().email().nullable().default(null),
});

export type ProfileClaimInsert = z.infer<typeof profileClaimInsertSchema>;

/**
 * What the person holding the link is shown before they agree to anything, from
 * the `preview_profile_claim` RPC. Deliberately a count rather than any of the
 * records themselves — enough to recognise the profile without disclosing
 * health data to whoever happens to have the link.
 */
export const profileClaimPreviewSchema = z.object({
  profile_id: z.string().uuid(),
  profile_name: z.string().nullable(),
  date_of_birth: isoDate.nullable(),
  manager_name: z.string().nullable(),
  record_count: z.number().int().nonnegative(),
  expires_at: isoDateTime,
  already_claimed: z.boolean(),
});

export type ProfileClaimPreview = z.infer<typeof profileClaimPreviewSchema>;

/** A manager's outstanding handover, from the `list_profile_claims` RPC. */
export const profileClaimSummarySchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  profile_name: z.string().nullable(),
  status: z.enum(CLAIM_STATUSES),
  invitee_email: z.string().nullable(),
  claimant_name: z.string().nullable(),
  claimed_at: isoDateTime.nullable(),
  expires_at: isoDateTime,
  created_at: isoDateTime,
});

export type ProfileClaimSummary = z.infer<typeof profileClaimSummarySchema>;
