import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Mock the Supabase client at the module boundary for every web test.
// Two reasons: the real module throws at import time without env vars, and
// component tests must never talk to a real backend — RLS and query behavior
// are covered by @nalvita/integration-tests against local Supabase.
vi.mock('@/lib/supabase', () => import('./mocks/supabase'));

afterEach(() => {
  cleanup();
});
