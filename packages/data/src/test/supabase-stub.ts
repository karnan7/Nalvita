import type { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

/**
 * A minimal Supabase client stub for this package's own tests.
 *
 * Deliberately small: almost everything here is pure logic, and the one module
 * that talks to Supabase in a unit test (`audit.ts`) only needs `rpc` and
 * `from`. The web app keeps its own fuller fixture set for component tests, and
 * real query behaviour is covered by `@nalvita/integration-tests` against a
 * local Supabase — not by stubs.
 */
export function makeSupabaseStub() {
  return {
    rpc: vi.fn(),
    from: vi.fn(),
    // The stub covers only the surface these tests exercise; the double cast is
    // the price of not implementing all of SupabaseClient.
  } as unknown as SupabaseClient;
}
