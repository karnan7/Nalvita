import { ActiveProfileContext, AuthProvider, NalvitaDataProvider } from '@nalvita/data';
import type { SupabaseClient } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { LockProvider } from '@/lib/lock';

/** The profile every fixture row belongs to. */
export const PROFILE_ID = '00000000-0000-4000-8000-0000000000aa';

/** One PostgREST-shaped link: awaitable, and still chainable. */
export function chain(payload: { data: unknown; error: unknown }) {
  const link = Promise.resolve(payload) as Promise<typeof payload> & Record<string, unknown>;
  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'is', 'order', 'limit']) {
    link[method] = () => link;
  }
  link.single = async () => payload;
  link.maybeSingle = async () => payload;
  return link;
}

/** A profiles row as PostgREST returns it, with obviously fake fixture data. */
export function makeProfileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-0000000000aa',
    user_id: '00000000-0000-4000-8000-000000000001',
    managed_by: null,
    full_name: null,
    date_of_birth: null,
    gender: null,
    blood_group: null,
    height_cm: null,
    weight_kg: null,
    is_minor: false,
    notification_detail: 'generic',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Routes `from(table)` per table, for screens that read several at once.
 * `profiles` answers a single row; everything else answers a list.
 */
export function stubTables(
  harness: Harness,
  tables: Partial<Record<string, Record<string, unknown>[]>>,
  profile: Record<string, unknown> = makeProfileRow(),
) {
  harness.from.mockImplementation((table: string) =>
    table === 'profiles'
      ? chain({ data: profile, error: null })
      : chain({ data: tables[table] ?? [], error: null }),
  );
  return harness;
}

export interface Harness {
  from: jest.Mock;
  rpc: jest.Mock;
  signOut: jest.Mock;
  openUrl: jest.Mock;
  client: SupabaseClient;
}

/** The account behind `signedIn: true`. Its profile row is `makeProfileRow()`. */
export const USER_ID = '00000000-0000-4000-8000-000000000001';

/**
 * A stub client plus the mocks a test needs to drive and assert on it.
 *
 * Signed out by default, which is all most screen tests need — they get their
 * profile from `ActiveProfileContext` directly. Pass `signedIn` for the few
 * things that read the session themselves, such as the emergency cache sync
 * looking up the profile row via `useProfile(session?.user.id)`.
 */
export function makeHarness({ signedIn = false }: { signedIn?: boolean } = {}): Harness {
  const from = jest.fn(() => chain({ data: makeProfileRow(), error: null }));
  const rpc = jest.fn(async () => ({ data: [], error: null }));
  const signOut = jest.fn(async () => ({ error: null }));
  const openUrl = jest.fn();

  const session = signedIn
    ? { user: { id: USER_ID, email: 'test@example.com' }, access_token: 'test-token' }
    : null;

  const client = {
    from,
    rpc,
    auth: {
      signOut,
      getSession: jest.fn(async () => ({ data: { session }, error: null })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    storage: { from: () => ({ createSignedUrl: jest.fn() }) },
  } as unknown as SupabaseClient;

  return { from, rpc, signOut, openUrl, client };
}

/** Renders inside the same provider stack the app uses. */
export function renderWithProviders(ui: ReactElement, harness: Harness = makeHarness()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
    return (
      <NalvitaDataProvider
        client={harness.client}
        appBaseUrl="https://nalvita.test"
        openUrl={harness.openUrl}
      >
        {/* Mirrors `navigation/root-layout.tsx`. Without it `useAuth()` returns
            the context default and every session-derived lookup — the profile
            row behind the emergency cache, most of all — is silently
            disabled. */}
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            {/* Every record hook is scoped to a profile and stays disabled
                until it has one, so a screen renders nothing at all without
                this. */}
            <ActiveProfileContext.Provider
              value={{
                profileId: PROFILE_ID,
                isSelf: true,
                viewing: null,
                setViewing: () => undefined,
                guardWrite: (write) => write(),
              }}
            >
              {/* The profile screen reads the lock preference for its settings
                  toggle, so screens need this the way the app has it. */}
              <LockProvider>{children}</LockProvider>
            </ActiveProfileContext.Provider>
          </QueryClientProvider>
        </AuthProvider>
      </NalvitaDataProvider>
    );
  }

  return { ...render(ui, { wrapper: Wrapper }), harness };
}
