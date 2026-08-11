// React Native Testing Library 13 registers its matchers on import of the
// library itself, so there is nothing to pull in here.

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
