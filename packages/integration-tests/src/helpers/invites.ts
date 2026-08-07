import { createHash, randomBytes } from 'node:crypto';
import type { CircleRole, ShareCategory } from '@nalvita/core';
import type { TestUser } from './clients.js';

/** SHA-256 hex, matching the server's `encode(digest(...),'hex')` and the web client. */
function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export interface CreatedInvite {
  id: string;
  token: string;
  code: string;
}

export interface CreateInviteOptions {
  role: CircleRole;
  categories: ShareCategory[];
  email?: string | null;
  /** ISO timestamp; pass a past value to simulate an expired invite. */
  expiresAt?: string;
}

/**
 * Creates an invite the way the web client does: generates the secrets, stores
 * only their hashes through the owner's own RLS-scoped insert, and returns the
 * plaintext token + code for the test to present to an invitee.
 */
export async function createInvite(
  owner: TestUser,
  options: CreateInviteOptions,
): Promise<CreatedInvite> {
  const token = randomBytes(24).toString('hex');
  const code = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0');

  const row: Record<string, unknown> = {
    owner_id: owner.profileId,
    token_hash: sha256Hex(token),
    code_hash: sha256Hex(code),
    invitee_email: options.email ?? null,
    requested_role: options.role,
    requested_categories: options.categories,
  };
  if (options.expiresAt) row.expires_at = options.expiresAt;

  const { data, error } = await owner.client
    .from('circle_invites')
    .insert(row)
    .select('id')
    .single();
  if (error) throw new Error(`Create invite failed: ${error.message}`);
  return { id: data.id as string, token, code };
}
