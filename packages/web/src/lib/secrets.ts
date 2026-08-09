import { INVITE_CODE_LENGTH } from '@nalvita/core';

/**
 * The two secrets behind every link the app sends — circle invites and profile
 * handovers alike.
 *
 * Only their hashes are ever stored, so the plaintext exists in exactly two
 * places: the screen that shows it once, and whatever the person does with it
 * afterwards. Generation lives here so both flows hash the same way the
 * database does, and neither can quietly drift to something weaker.
 */

/** Lower-case hex SHA-256, matching the server's `encode(digest(...),'hex')`. */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** A high-entropy link secret (192 bits) — the real credential, hidden in the link. */
export function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * A short code for someone who would rather type than follow a link. Low
 * entropy on purpose, which is why every failed lookup is throttled server-side.
 */
export function randomCode(): string {
  const max = 10 ** INVITE_CODE_LENGTH;
  const n = (crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) % max;
  return n.toString().padStart(INVITE_CODE_LENGTH, '0');
}

/** Generates a link/code pair and the hashes to store for them. */
export async function newSecretPair(): Promise<{
  token: string;
  code: string;
  token_hash: string;
  code_hash: string;
}> {
  const token = randomToken();
  const code = randomCode();
  const [token_hash, code_hash] = await Promise.all([sha256Hex(token), sha256Hex(code)]);
  return { token, code, token_hash, code_hash };
}
