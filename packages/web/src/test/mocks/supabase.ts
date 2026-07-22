import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

/**
 * Typed stub standing in for `@/lib/supabase` (wired up in test/setup.ts).
 * Tests override individual methods per scenario, e.g.:
 *
 *   vi.mocked(supabase.auth.verifyOtp).mockResolvedValue(...)
 */
export const supabase = {
  auth: {
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    signInWithOtp: vi.fn(async () => ({ data: {}, error: null })),
    verifyOtp: vi.fn(async () => ({ data: {}, error: null })),
    signInWithOAuth: vi.fn(async () => ({ data: {}, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
  },
  from: vi.fn(),
  storage: { from: vi.fn() },
  // The stub only covers the client surface the app uses; the double cast is
  // the price of not implementing all of SupabaseClient.
} as unknown as SupabaseClient;

/** A signed-in session with obviously fake, non-PII fixture data. */
export function makeSession(): Session {
  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'test.user@example.com',
      aud: 'authenticated',
      role: 'authenticated',
    },
  } as unknown as Session;
}

/** A profiles row as PostgREST would return it; empty (fresh signup) by default. */
export function makeProfileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-0000000000aa',
    user_id: '00000000-0000-4000-8000-000000000001',
    full_name: null,
    date_of_birth: null,
    gender: null,
    blood_group: null,
    height_cm: null,
    weight_kg: null,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Makes `supabase.from('profiles').select().eq().single()` resolve to the given row. */
export function stubProfileSelect(row: Record<string, unknown>) {
  vi.mocked(supabase.from).mockReturnValue({
    select: () => ({ eq: () => ({ single: async () => ({ data: row, error: null }) }) }),
  } as never);
}
