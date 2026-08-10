// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActiveProfileContext } from './active-profile-context';
import { useAllergies } from './allergies';
import { useActivityFeed } from './audit';
import { useCirclePeople, useInvitePreview, usePendingInvites } from './circle';
import { NalvitaDataProvider } from './client';
import { useConditions } from './conditions';
import { useDoctors } from './doctors';
import { useDocuments, useDownloadDocument, useSignedUrl } from './documents';
import { useClaimPreview, useManagedProfiles, useProfileClaims } from './managed-profiles';
import { useMedicines } from './medicines';
import { useProfile, useProfileById } from './profile';
import { useVitals } from './vitals';

const PROFILE_ID = '00000000-0000-4000-8000-0000000000aa';
const USER_ID = '00000000-0000-4000-8000-000000000001';

/**
 * One link in a PostgREST chain: a real promise that also carries the chain
 * methods, so a hook may narrow and order in any order and await whenever it
 * stops. `single`/`maybeSingle` resolve the same payload.
 */
function chain(payload: { data: unknown; error: unknown }) {
  const link = Promise.resolve(payload) as Promise<typeof payload> & Record<string, unknown>;
  for (const method of ['select', 'eq', 'is', 'order', 'limit', 'ilike']) {
    link[method] = () => link;
  }
  link.single = async () => payload;
  link.maybeSingle = async () => payload;
  return link;
}

const createSignedUrl = vi.fn(async () => ({
  data: { signedUrl: 'https://storage.test/signed' },
  error: null,
}));
const from = vi.fn();
const rpc = vi.fn(async () => ({ data: [], error: null }));
const openUrl = vi.fn();

const client = {
  from,
  rpc,
  storage: { from: () => ({ createSignedUrl }) },
} as never;

function wrapper({ children }: Readonly<{ children: ReactNode }>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <NalvitaDataProvider client={client} appBaseUrl="https://nalvita.test" openUrl={openUrl}>
      <QueryClientProvider client={queryClient}>
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

beforeEach(() => {
  vi.clearAllMocks();
  from.mockImplementation(() => chain({ data: [], error: null }));
  rpc.mockImplementation(async () => ({ data: [], error: null }));
});

/**
 * Every record hook reads through the injected client — the whole point of the
 * package. Asserting the table each one asks for also pins the scoping: a hook
 * that quietly read the wrong table would still "work" against a loose stub.
 */
describe.each([
  ['medicines', useMedicines],
  ['vitals', useVitals],
  ['documents', useDocuments],
  ['allergies', useAllergies],
  ['conditions', useConditions],
  ['doctors', useDoctors],
])('%s list hook', (table, useHook) => {
  it(`reads ${table} through the injected client`, async () => {
    const { result } = renderHook(() => useHook(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(from).toHaveBeenCalledWith(table);
    expect(result.current.data).toEqual([]);
  });
});

describe('profile hooks', () => {
  const row = {
    id: PROFILE_ID,
    user_id: USER_ID,
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
  };

  it('looks my profile up by account', async () => {
    from.mockImplementation(() => chain({ data: row, error: null }));

    const { result } = renderHook(() => useProfile(USER_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(from).toHaveBeenCalledWith('profiles');
    expect(result.current.data?.id).toBe(PROFILE_ID);
  });

  it('looks any profile I may see up by its own id', async () => {
    from.mockImplementation(() => chain({ data: row, error: null }));

    const { result } = renderHook(() => useProfileById(PROFILE_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(from).toHaveBeenCalledWith('profiles');
  });

  it('asks for nothing until it knows whose profile to fetch', () => {
    renderHook(() => useProfile(undefined), { wrapper });

    expect(from).not.toHaveBeenCalled();
  });

  it('lists the profiles an account looks after', async () => {
    const { result } = renderHook(() => useManagedProfiles(USER_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(from).toHaveBeenCalledWith('profiles');
  });
});

describe('circle and handover hooks', () => {
  it('reads people and claims through RPCs, not table reads', async () => {
    const people = renderHook(() => useCirclePeople(), { wrapper });
    const claims = renderHook(() => useProfileClaims(), { wrapper });

    await waitFor(() => expect(people.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(claims.result.current.isSuccess).toBe(true));

    expect(rpc).toHaveBeenCalledWith('list_circle_people');
    expect(rpc).toHaveBeenCalledWith('list_profile_claims');
  });

  it('lists still-open invites from the invites table', async () => {
    const { result } = renderHook(() => usePendingInvites(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(from).toHaveBeenCalledWith('circle_invites');
  });

  it('pages the activity feed through the feed RPC', async () => {
    const { result } = renderHook(() => useActivityFeed(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rpc).toHaveBeenCalledWith(
      'list_audit_feed',
      expect.objectContaining({ p_before_at: null, p_before_id: null }),
    );
  });

  it('previews an invite and a claim only once there is a secret to look up', async () => {
    renderHook(() => useInvitePreview(null), { wrapper });
    renderHook(() => useClaimPreview(null), { wrapper });
    expect(rpc).not.toHaveBeenCalled();

    rpc.mockImplementation(async () => ({ data: [], error: null }));
    renderHook(() => useInvitePreview('secret'), { wrapper });
    renderHook(() => useClaimPreview('secret'), { wrapper });

    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith('preview_circle_invite', { p_secret: 'secret' });
      expect(rpc).toHaveBeenCalledWith('preview_profile_claim', { p_secret: 'secret' });
    });
  });
});

describe('document files', () => {
  it('signs a URL on demand rather than storing one', async () => {
    const { result } = renderHook(() => useSignedUrl('me/report.pdf'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createSignedUrl).toHaveBeenCalledWith('me/report.pdf', 60);
    expect(result.current.data).toBe('https://storage.test/signed');
  });

  it('hands a download URL to the platform instead of opening it itself', async () => {
    const { result } = renderHook(() => useDownloadDocument(), { wrapper });

    await result.current({
      id: 'd1',
      title: 'Blood test',
      file_path: 'me/report.pdf',
      file_type: 'application/pdf',
    } as never);

    // Named for the person, and marked as a download rather than a view.
    expect(createSignedUrl).toHaveBeenCalledWith('me/report.pdf', 60, {
      download: 'Blood test.pdf',
    });
    expect(openUrl).toHaveBeenCalledWith('https://storage.test/signed');
  });

  it('surfaces a refused signature instead of opening nothing', async () => {
    createSignedUrl.mockResolvedValueOnce({ data: null, error: { message: 'denied' } } as never);

    const { result } = renderHook(() => useDownloadDocument(), { wrapper });

    await expect(
      result.current({ file_path: 'me/report.pdf', file_type: 'application/pdf' } as never),
    ).rejects.toMatchObject({ message: 'denied' });
    expect(openUrl).not.toHaveBeenCalled();
  });
});
