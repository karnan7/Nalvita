import {
  allergySchema,
  medicineSchema,
  profileSchema,
  type Allergy,
  type Medicine,
} from '@nalvita/core';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { createMMKV, type MMKV } from 'react-native-mmkv';
import { z } from 'zod';

/**
 * The offline emergency cache.
 *
 * This is the only health data Nalvita ever writes to the device. Everything
 * else — documents, vitals history, the audit feed, the timeline — stays online
 * only and disappears with the network, deliberately.
 *
 * The reason for the line being here: cached records sit in device storage,
 * outside Supabase's row-level security. RLS cannot revoke a copy that has
 * already been written to a phone. So the cache holds exactly the subset a
 * paramedic would need from an unconscious patient with no signal — who they
 * are, their blood group, what they are allergic to, what they are currently
 * taking — and nothing else. Widening it is a privacy decision, not a
 * convenience one.
 *
 * The store is AES-encrypted with a key that lives in `expo-secure-store` (the
 * iOS Keychain / Android EncryptedSharedPreferences), never a constant in the
 * bundle: a hardcoded key in a public repo would be no encryption at all.
 */

/** Where the encryption key lives in the device keystore. */
const KEY_ALIAS = 'nalvita.offline.key';

/** MMKV instance id. One store, so the whole cache is one file to wipe. */
const CACHE_ID = 'nalvita.offline';

/**
 * The single key inside the store.
 *
 * Everything cached goes in one snapshot under one key, which is what makes
 * "nothing beyond the defined set is cached" checkable rather than a promise —
 * see the test asserting the store never holds a second key.
 */
const SNAPSHOT_KEY = 'emergency-snapshot';

/**
 * AES-256 rather than MMKV's AES-128 default: this is health data, and the only
 * cost is a longer key. MMKV caps that key at 32 bytes for AES-256, so the key
 * is exactly 32 characters from a 64-symbol alphabet — 192 bits of entropy, and
 * short enough that MMKV will not silently truncate it.
 */
const KEY_LENGTH = 32;
const KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * The emergency-relevant slice of a profile.
 *
 * Height and weight are left out on purpose: they are not what anyone needs in
 * an ambulance, and every field kept off the device is one that cannot leak
 * from a lost phone.
 */
const emergencyProfileSchema = profileSchema.pick({
  full_name: true,
  date_of_birth: true,
  gender: true,
  blood_group: true,
});

export const emergencySnapshotSchema = z.object({
  /** Bumped whenever the shape changes, so an old snapshot is dropped, not misread. */
  version: z.literal(1),
  /** Whose records these are — a snapshot must never be shown for another profile. */
  profileId: z.string().uuid(),
  savedAt: z.string(),
  profile: emergencyProfileSchema,
  allergies: z.array(allergySchema),
  /** Active only. A medicine someone stopped taking is not emergency information. */
  medicines: z.array(medicineSchema),
});

export type EmergencySnapshot = z.infer<typeof emergencySnapshotSchema>;

const SNAPSHOT_VERSION = 1;

/** Reads the cache key, creating one on first use. */
async function loadEncryptionKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_ALIAS);
  if (existing) return existing;

  const bytes = await Crypto.getRandomBytesAsync(KEY_LENGTH);
  let key = '';
  for (const byte of bytes) {
    key += KEY_ALPHABET[byte % KEY_ALPHABET.length];
  }

  await SecureStore.setItemAsync(KEY_ALIAS, key);
  return key;
}

let cachePromise: Promise<MMKV> | null = null;

/**
 * The encrypted store, opened once per app run.
 *
 * Async because the key comes from the keystore, and memoised because opening
 * MMKV twice with the same id is wasteful — callers can await it freely.
 */
export function openOfflineCache(): Promise<MMKV> {
  cachePromise ??= loadEncryptionKey().then((encryptionKey) =>
    createMMKV({ id: CACHE_ID, encryptionKey, encryptionType: 'AES-256' }),
  );
  return cachePromise;
}

/**
 * Writes the emergency set.
 *
 * Medicines are filtered to active here rather than trusted from the caller, so
 * there is one place where "what goes offline" is decided.
 */
export async function saveEmergencySnapshot(input: {
  profileId: string;
  profile: z.input<typeof emergencyProfileSchema>;
  allergies: readonly Allergy[];
  medicines: readonly Medicine[];
}): Promise<void> {
  const snapshot: EmergencySnapshot = emergencySnapshotSchema.parse({
    version: SNAPSHOT_VERSION,
    profileId: input.profileId,
    savedAt: new Date().toISOString(),
    profile: emergencyProfileSchema.parse(input.profile),
    allergies: input.allergies,
    medicines: input.medicines.filter((medicine) => medicine.status === 'active'),
  });

  const cache = await openOfflineCache();
  cache.set(SNAPSHOT_KEY, JSON.stringify(snapshot));
}

/**
 * Reads the snapshot back for a profile, or null when there is nothing usable.
 *
 * Anything unparseable is deleted rather than repaired. A snapshot that does
 * not match its schema is either a stale version or something that has been
 * tampered with, and showing a half-understood allergy list is worse than
 * showing none — this is data someone may act on in an emergency.
 */
export async function readEmergencySnapshot(
  profileId: string,
): Promise<EmergencySnapshot | null> {
  const cache = await openOfflineCache();
  const raw = cache.getString(SNAPSHOT_KEY);
  if (!raw) return null;

  const parsed = emergencySnapshotSchema.safeParse(safeJsonParse(raw));
  if (!parsed.success) {
    cache.remove(SNAPSHOT_KEY);
    return null;
  }

  // A snapshot belongs to one profile. Switching profiles must not show the
  // previous one's allergies.
  if (parsed.data.profileId !== profileId) return null;

  return parsed.data;
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Wipes every cached record.
 *
 * Called on sign-out: the next person to hold the phone must not find the last
 * one's allergy list. The encryption key is dropped too, so anything that
 * somehow survives on disk is unreadable.
 */
export async function clearOfflineCache(): Promise<void> {
  const cache = await openOfflineCache();
  cache.clearAll();
  await SecureStore.deleteItemAsync(KEY_ALIAS);
  cachePromise = null;
}

/** Test seam: forces the next `openOfflineCache` to re-read the key. */
export function resetOfflineCacheForTests(): void {
  cachePromise = null;
}

/** Test seam: the keys actually present, for the "nothing else is cached" guard. */
export async function cachedKeysForTests(): Promise<string[]> {
  const cache = await openOfflineCache();
  return cache.getAllKeys();
}
