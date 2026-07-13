import type { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

/**
 * Typed stub standing in for `@/lib/supabase` (wired up in test/setup.ts).
 * Tests override individual methods per scenario, e.g.:
 *
 *   vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue(...)
 */
export const supabase = {
  auth: {
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  },
  from: vi.fn(),
  storage: { from: vi.fn() },
  // The stub only covers the client surface the app uses; the double cast is
  // the price of not implementing all of SupabaseClient.
} as unknown as SupabaseClient;
