// @vitest-environment jsdom
import type { SupabaseClient } from '@supabase/supabase-js';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { NalvitaDataProvider, usePlatform, useSupabase } from './client';
import { makeSupabaseStub } from './test/supabase-stub';

const client = makeSupabaseStub();
const openUrl = vi.fn();

function wrapper({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <NalvitaDataProvider client={client} appBaseUrl="https://nalvita.test" openUrl={openUrl}>
      {children}
    </NalvitaDataProvider>
  );
}

describe('usePlatform', () => {
  it('hands back exactly what the host app supplied', () => {
    const { result } = renderHook(() => usePlatform(), { wrapper });

    expect(result.current.client).toBe(client);
    expect(result.current.appBaseUrl).toBe('https://nalvita.test');
    expect(result.current.openUrl).toBe(openUrl);
  });

  it('fails loudly rather than sending health queries nowhere', () => {
    // React logs the thrown error; silence it so the run stays readable.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => usePlatform())).toThrow(/NalvitaDataProvider/);

    consoleError.mockRestore();
  });
});

describe('useSupabase', () => {
  it('is the client, without the rest of the platform', () => {
    const { result } = renderHook(() => useSupabase(), { wrapper });

    expect(result.current).toBe(client);
  });

  it('keeps the same client across re-renders so queries are not re-keyed', () => {
    const { result, rerender } = renderHook(() => useSupabase(), { wrapper });
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});

/**
 * The point of the injection: two apps can hold different clients at once, and
 * neither leaks into the other. A module-level singleton could not do this.
 */
describe('two providers', () => {
  it('gives each tree its own client', () => {
    const other = makeSupabaseStub();
    function otherWrapper({ children }: Readonly<{ children: ReactNode }>) {
      return (
        <NalvitaDataProvider client={other} appBaseUrl="https://other.test" openUrl={vi.fn()}>
          {children}
        </NalvitaDataProvider>
      );
    }

    const a = renderHook(() => useSupabase(), { wrapper });
    const b = renderHook(() => useSupabase(), { wrapper: otherWrapper });

    expect(a.result.current).toBe(client as SupabaseClient);
    expect(b.result.current).toBe(other);
  });
});
