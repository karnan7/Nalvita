import { supabase } from '@/lib/supabase';
import { describe, expect, it, vi } from 'vitest';

describe('supabase module boundary', () => {
  it('is mocked in tests, so importing it needs no env vars', () => {
    // The real module throws at import time when VITE_SUPABASE_URL is
    // missing (as in CI). This test fails loudly if the global mock in
    // test/setup.ts ever stops covering the module — checking for the mock
    // itself, not just a working client, so a local .env can't mask it.
    expect(vi.isMockFunction(supabase.from)).toBe(true);
    expect(supabase.auth).toBeDefined();
  });
});
