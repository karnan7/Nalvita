import * as SecureStore from 'expo-secure-store';

import { secureStorage } from '@/lib/secure-storage';

/** The in-memory map standing in for the keystore (see src/test/setup.ts). */
const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

/** Android refuses values past this; the adapter exists to stay under it. */
const ANDROID_LIMIT = 2048;

const KEY = 'sb-abcdefgh-auth-token';

beforeEach(() => {
  store.clear();
  jest.clearAllMocks();
});

describe('short values', () => {
  it('round-trips without chunking', async () => {
    await secureStorage.setItem(KEY, 'a short session');

    expect(await secureStorage.getItem(KEY)).toBe('a short session');
    // One key, no chunk bookkeeping.
    expect([...store.keys()]).toEqual([KEY]);
  });

  it('reads back nothing for a key that was never written', async () => {
    expect(await secureStorage.getItem(KEY)).toBeNull();
  });
});

describe('values past the Android limit', () => {
  // A realistic Supabase session: two JWTs plus the user object.
  const session = JSON.stringify({
    access_token: 'a'.repeat(1500),
    refresh_token: 'r'.repeat(800),
    user: { id: '00000000-0000-4000-8000-000000000001' },
  });

  it('is the case that motivates this adapter at all', () => {
    expect(session.length).toBeGreaterThan(ANDROID_LIMIT);
  });

  it('round-trips exactly, in chunks', async () => {
    await secureStorage.setItem(KEY, session);

    expect(await secureStorage.getItem(KEY)).toBe(session);
  });

  it('keeps every stored chunk under the Android limit', async () => {
    await secureStorage.setItem(KEY, session);

    for (const value of store.values()) {
      expect(value.length).toBeLessThan(ANDROID_LIMIT);
    }
  });

  it('records how many chunks there are, so a read knows what to fetch', async () => {
    await secureStorage.setItem(KEY, session);

    expect(store.get(`${KEY}.chunks`)).toBe('2');
    expect(store.has(`${KEY}.0`)).toBe(true);
    expect(store.has(`${KEY}.1`)).toBe(true);
  });
});

describe('replacing a value', () => {
  const long = 'x'.repeat(4000);

  it('leaves no chunks behind when a long value becomes a short one', async () => {
    await secureStorage.setItem(KEY, long);
    await secureStorage.setItem(KEY, 'short');

    expect(await secureStorage.getItem(KEY)).toBe('short');
    expect([...store.keys()]).toEqual([KEY]);
  });

  it('does not read a stale single value when a short value becomes long', async () => {
    await secureStorage.setItem(KEY, 'short');
    await secureStorage.setItem(KEY, long);

    expect(await secureStorage.getItem(KEY)).toBe(long);
  });
});

describe('a partially written session', () => {
  /**
   * Half a session is worse than none — it would present as signed in and then
   * fail every request. The adapter reports signed-out and clears the remains.
   */
  it('reports nothing and cleans up when a chunk has gone missing', async () => {
    await secureStorage.setItem(KEY, 'y'.repeat(4000));
    store.delete(`${KEY}.1`);

    expect(await secureStorage.getItem(KEY)).toBeNull();
    expect(store.size).toBe(0);
  });
});

describe('removing a value', () => {
  it('clears both the chunks and the count', async () => {
    await secureStorage.setItem(KEY, 'z'.repeat(4000));
    await secureStorage.removeItem(KEY);

    expect(await secureStorage.getItem(KEY)).toBeNull();
    expect(store.size).toBe(0);
  });
});

describe('key safety', () => {
  it('normalises characters SecureStore would reject', async () => {
    await secureStorage.setItem('weird key/with:chars', 'value');

    for (const key of store.keys()) {
      expect(key).toMatch(/^[A-Za-z0-9._-]+$/);
    }
    expect(await secureStorage.getItem('weird key/with:chars')).toBe('value');
  });
});
