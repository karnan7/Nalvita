import { createHash, randomBytes } from 'node:crypto';
import type { TestUser } from './clients.js';

/** SHA-256 hex, matching the server's `encode(digest(...),'hex')` and the web client. */
function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Creates a profile the manager looks after, through their own RLS-scoped insert. */
export async function createManagedProfile(
  manager: TestUser,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await manager.client
    .from('profiles')
    .insert({ managed_by: manager.id, full_name: 'Managed Person', ...overrides })
    .select('id')
    .single();
  if (error) throw new Error(`Create managed profile failed: ${error.message}`);
  return data.id as string;
}

export interface CreatedClaim {
  id: string;
  token: string;
  code: string;
}

/**
 * Starts a handover the way the web client does: generates the secrets, stores
 * only their hashes, and returns the plaintext for the test to present.
 */
export async function createClaim(
  manager: TestUser,
  profileId: string,
  options: { email?: string | null; expiresAt?: string } = {},
): Promise<CreatedClaim> {
  const token = randomBytes(24).toString('hex');
  const code = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0');

  const row: Record<string, unknown> = {
    profile_id: profileId,
    manager_id: manager.id,
    token_hash: sha256Hex(token),
    code_hash: sha256Hex(code),
    invitee_email: options.email ?? null,
  };
  if (options.expiresAt) row.expires_at = options.expiresAt;

  const { data, error } = await manager.client
    .from('profile_claims')
    .insert(row)
    .select('id')
    .single();
  if (error) throw new Error(`Create claim failed: ${error.message}`);
  return { id: data.id as string, token, code };
}
