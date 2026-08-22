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

// MMKV is a Nitro native module with no JS fallback. Backing it with a map
// keyed by instance id — shared across instances, the way a real store on disk
// is — means the caching, versioning and wipe logic is exercised for real
// rather than mocked away.
jest.mock('react-native-mmkv', () => {
  const stores = new Map<string, Map<string, string>>();
  /** Every config the app opened a store with, so tests can assert encryption. */
  const configs: { id: string; encryptionKey?: string; encryptionType?: string }[] = [];

  const createMMKV = (config: { id: string; encryptionKey?: string; encryptionType?: string }) => {
    configs.push(config);

    let store = stores.get(config.id);
    if (!store) {
      store = new Map<string, string>();
      stores.set(config.id, store);
    }
    const backing = store;

    return {
      id: config.id,
      set: (key: string, value: string) => backing.set(key, value),
      getString: (key: string) => backing.get(key),
      remove: (key: string) => backing.delete(key),
      contains: (key: string) => backing.has(key),
      clearAll: () => backing.clear(),
      getAllKeys: () => [...backing.keys()],
    };
  };

  return { createMMKV, __stores: stores, __configs: configs };
});

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  authenticateAsync: jest.fn(async () => ({ success: true })),
}));

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
  useNetworkState: jest.fn(() => ({ isConnected: true, isInternetReachable: true })),
}));

// Push registration (KAR-52). Defaults describe the ordinary case: a real
// phone, permission already granted, Expo issuing a token. Tests narrow these
// to the cases that matter — a simulator, a refusal, an unreachable Expo.
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test-device]' })),
}));

jest.mock('expo-device', () => ({
  // Without __esModule, babel's interop hands the module under test a *copy*
  // of this object, and a test flipping `isDevice` would change only its own
  // copy — the simulator case would silently never be exercised.
  __esModule: true,
  isDevice: true,
  // The model name, never the owner-given device name — see lib/push.ts.
  modelName: 'Pixel 7',
}));

// Expo issues push tokens against an EAS project. The real id is written into
// app.json by `npx eas init`; until that is run the app has none and
// registration no-ops, which is why tests supply one explicitly.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'test-project-id' } } } },
}));
