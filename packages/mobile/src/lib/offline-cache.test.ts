import { allergySchema, medicineSchema } from '@nalvita/core';
import * as SecureStore from 'expo-secure-store';

import {
  cachedKeysForTests,
  clearOfflineCache,
  openOfflineCache,
  readEmergencySnapshot,
  resetOfflineCacheForTests,
  saveEmergencySnapshot,
} from '@/lib/offline-cache';
import { makeAllergyRow, makeMedicineRow } from '@/test/fixtures';

/** Recorded by the MMKV mock in `src/test/setup.ts`. */
const { __configs: configs } = jest.requireMock('react-native-mmkv') as {
  __configs: { id: string; encryptionKey?: string; encryptionType?: string }[];
};

const PROFILE_ID = '00000000-0000-4000-8000-0000000000aa';
const OTHER_PROFILE_ID = '00000000-0000-4000-8000-0000000000bb';

const PROFILE = {
  full_name: 'Test Person',
  date_of_birth: '1950-01-01',
  gender: 'female' as const,
  blood_group: 'O+' as const,
};

function allergy(overrides: Record<string, unknown> = {}) {
  return allergySchema.parse(makeAllergyRow(overrides));
}

function medicine(overrides: Record<string, unknown> = {}) {
  return medicineSchema.parse(makeMedicineRow(overrides));
}

async function save(profileId = PROFILE_ID) {
  await saveEmergencySnapshot({
    profileId,
    profile: PROFILE,
    allergies: [allergy()],
    medicines: [medicine()],
  });
}

beforeEach(async () => {
  await clearOfflineCache();
  resetOfflineCacheForTests();
});

describe('the emergency snapshot', () => {
  it('reads back what was written', async () => {
    await save();

    const found = await readEmergencySnapshot(PROFILE_ID);

    expect(found?.profile.blood_group).toBe('O+');
    expect(found?.allergies).toHaveLength(1);
    expect(found?.allergies[0]?.allergen).toBe('Penicillin');
    expect(found?.medicines[0]?.name).toBe('Metformin');
  });

  it('returns null when nothing has been cached', async () => {
    await expect(readEmergencySnapshot(PROFILE_ID)).resolves.toBeNull();
  });

  it('keeps only active medicines — a stopped medicine is not emergency information', async () => {
    await saveEmergencySnapshot({
      profileId: PROFILE_ID,
      profile: PROFILE,
      allergies: [],
      medicines: [
        medicine({ id: '00000000-0000-4000-8000-0000000000e1', status: 'active' }),
        medicine({ id: '00000000-0000-4000-8000-0000000000e2', status: 'stopped' }),
      ],
    });

    const found = await readEmergencySnapshot(PROFILE_ID);

    expect(found?.medicines).toHaveLength(1);
    expect(found?.medicines[0]?.status).toBe('active');
  });

  it('never answers with another profile’s records', async () => {
    await save(PROFILE_ID);

    await expect(readEmergencySnapshot(OTHER_PROFILE_ID)).resolves.toBeNull();
  });
});

describe('the cache boundary', () => {
  /**
   * The acceptance criterion "nothing beyond that defined offline set is
   * cached" only means something if it is checked. Everything cached lives
   * under one key, so a second key appearing is the alarm.
   */
  it('holds exactly one key, however much is written', async () => {
    await save();
    await save();

    await expect(cachedKeysForTests()).resolves.toEqual(['emergency-snapshot']);
  });

  it('caches no documents, vitals or audit entries', async () => {
    await save();

    const cache = await openOfflineCache();
    const everything = cache.getString('emergency-snapshot') ?? '';

    // The snapshot is the only thing on disk, so its own contents are the
    // whole surface: if a document title or a reading ever appears here, the
    // offline set has been widened without the privacy decision being made.
    expect(everything).not.toContain('file_path');
    expect(everything).not.toContain('measured_at');
    expect(everything).not.toContain('doc_date');
  });
});

describe('corruption and tampering', () => {
  it('drops a snapshot that does not match its schema rather than half-reading it', async () => {
    await save();
    const cache = await openOfflineCache();
    cache.set('emergency-snapshot', JSON.stringify({ version: 1, allergies: 'not-a-list' }));

    await expect(readEmergencySnapshot(PROFILE_ID)).resolves.toBeNull();
    // and it is gone, not left to fail again
    await expect(cachedKeysForTests()).resolves.toEqual([]);
  });

  it('drops unparseable JSON', async () => {
    await save();
    const cache = await openOfflineCache();
    cache.set('emergency-snapshot', '{ not json');

    await expect(readEmergencySnapshot(PROFILE_ID)).resolves.toBeNull();
  });

  it('drops a snapshot written by an older version', async () => {
    await save();
    const cache = await openOfflineCache();
    const stored = JSON.parse(cache.getString('emergency-snapshot') ?? '{}');
    cache.set('emergency-snapshot', JSON.stringify({ ...stored, version: 0 }));

    await expect(readEmergencySnapshot(PROFILE_ID)).resolves.toBeNull();
  });
});

describe('the encryption key', () => {
  it('is generated, kept in the device keystore, and never hardcoded', async () => {
    await openOfflineCache();

    const key = await SecureStore.getItemAsync('nalvita.offline.key');

    // 32 characters: MMKV's ceiling for AES-256, and what we ask it for.
    expect(key).toHaveLength(32);
    // A key that is the same on every install would be no protection at all.
    expect(key).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it('reuses the stored key rather than rotating it on every launch', async () => {
    await openOfflineCache();
    const first = await SecureStore.getItemAsync('nalvita.offline.key');

    resetOfflineCacheForTests();
    await openOfflineCache();

    await expect(SecureStore.getItemAsync('nalvita.offline.key')).resolves.toBe(first);
  });

  it('opens the store encrypted with that key, not in the clear', async () => {
    await openOfflineCache();

    const key = await SecureStore.getItemAsync('nalvita.offline.key');
    const opened = configs.at(-1);

    expect(opened?.id).toBe('nalvita.offline');
    expect(opened?.encryptionKey).toBe(key);
    expect(opened?.encryptionType).toBe('AES-256');
  });
});

describe('signing out', () => {
  it('wipes the records and drops the key with them', async () => {
    await save();

    await clearOfflineCache();

    await expect(SecureStore.getItemAsync('nalvita.offline.key')).resolves.toBeNull();
    await expect(readEmergencySnapshot(PROFILE_ID)).resolves.toBeNull();
  });
});
