// React Native Testing Library 13 registers its matchers on import of the
// library itself, so there is nothing to pull in here.

// `src/lib/supabase.ts` throws at import without these, deliberately — it is
// the same loud failure the web client has. Tests never reach the network.
process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
process.env.EXPO_PUBLIC_APP_BASE_URL ??= 'https://nalvita.test';

// The device keystore does not exist under Jest. Back it with a plain in-memory
// map so the chunking logic in `secure-storage.ts` is exercised for real —
// mocking the adapter itself would test nothing.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __store: store,
  };
});
