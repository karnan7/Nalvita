import * as SecureStore from 'expo-secure-store';

/**
 * Supabase auth storage backed by the device keystore.
 *
 * `expo-secure-store` is the Keychain on iOS and EncryptedSharedPreferences on
 * Android, so the session sits behind hardware-backed encryption. AsyncStorage
 * would be plain text on disk — never use it for a session that can read
 * someone's health records.
 *
 * The catch: Android warns above 2048 bytes and can refuse to store the value
 * outright. A Supabase session carries two JWTs plus the user object and
 * routinely exceeds that, so values are split across numbered chunks. Anything
 * shorter than one chunk is still written as a single key, so the common case
 * costs nothing.
 */

/** Comfortably under Android's 2048-byte ceiling, leaving room for key overhead. */
const CHUNK_SIZE = 1800;

/** Where the chunk count lives, so a read knows how many keys to fetch. */
function countKey(key: string): string {
  return `${key}.chunks`;
}

function chunkKey(key: string, index: number): string {
  return `${key}.${index}`;
}

/**
 * SecureStore keys must be alphanumeric plus `.`, `-`, and `_`. Supabase's keys
 * contain the project ref and are already safe, but a stray character would
 * fail at runtime rather than compile time, so normalise defensively.
 */
function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

async function clearChunks(key: string): Promise<void> {
  const stored = await SecureStore.getItemAsync(countKey(key));
  const count = stored ? Number.parseInt(stored, 10) : 0;
  if (!Number.isFinite(count) || count <= 0) return;

  await Promise.all([
    SecureStore.deleteItemAsync(countKey(key)),
    ...Array.from({ length: count }, (_, index) =>
      SecureStore.deleteItemAsync(chunkKey(key, index)),
    ),
  ]);
}

export const secureStorage = {
  async getItem(rawKey: string): Promise<string | null> {
    const key = safeKey(rawKey);

    const countRaw = await SecureStore.getItemAsync(countKey(key));
    if (countRaw === null) {
      // Not chunked — either a short value or nothing at all.
      return SecureStore.getItemAsync(key);
    }

    const count = Number.parseInt(countRaw, 10);
    if (!Number.isFinite(count) || count <= 0) return null;

    const parts = await Promise.all(
      Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(chunkKey(key, index))),
    );

    // A missing chunk means a partial write or a partial wipe. Half a session
    // is worse than none: report signed-out and let the app re-authenticate.
    if (parts.some((part) => part === null)) {
      await clearChunks(key);
      return null;
    }
    return parts.join('');
  },

  async setItem(rawKey: string, value: string): Promise<void> {
    const key = safeKey(rawKey);

    // Whatever shape the previous value had, it must not survive this write.
    await Promise.all([clearChunks(key), SecureStore.deleteItemAsync(key)]);

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    const chunks: string[] = [];
    for (let start = 0; start < value.length; start += CHUNK_SIZE) {
      chunks.push(value.slice(start, start + CHUNK_SIZE));
    }

    // Chunks first, then the count — so a failure part-way through leaves no
    // count pointing at chunks that were never written.
    await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(key, index), chunk)));
    await SecureStore.setItemAsync(countKey(key), String(chunks.length));
  },

  async removeItem(rawKey: string): Promise<void> {
    const key = safeKey(rawKey);
    await Promise.all([clearChunks(key), SecureStore.deleteItemAsync(key)]);
  },
};
