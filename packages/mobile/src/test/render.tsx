import { ActiveProfileContext, NalvitaDataProvider } from '@nalvita/data';
import type { SupabaseClient } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

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

/** A stub client plus the mocks a test needs to drive and assert on it. */
export function makeHarness(): Harness {
  const from = jest.fn(() => chain({ data: makeProfileRow(), error: null }));
  const rpc = jest.fn(async () => ({ data: [], error: null }));
  const signOut = jest.fn(async () => ({ error: null }));
  const openUrl = jest.fn();

  const client = {
    from,
    rpc,
    auth: {
      signOut,
      getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
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
        <QueryClientProvider client={queryClient}>
          {/* Every record hook is scoped to a profile and stays disabled until
              it has one, so a screen renders nothing at all without this. */}
          <ActiveProfileContext.Provider
            value={{
              profileId: PROFILE_ID,
              isSelf: true,
              viewing: null,
              setViewing: () => undefined,
              guardWrite: (write) => write(),
            }}
          >
            {children}
          </ActiveProfileContext.Provider>
        </QueryClientProvider>
      </NalvitaDataProvider>
    );
  }

  return { ...render(ui, { wrapper: Wrapper }), harness };
}
