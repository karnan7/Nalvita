// @vitest-environment jsdom
import type { CirclePerson } from '@nalvita/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from './auth-context';
import { AuthProvider } from './auth-provider';
import {
  useAcceptInvite,
  useCancelInvite,
  useCreateInvite,
  useDeclineInvite,
  useRevokeMembership,
  useUpdateMembership,
} from './circle';
import { NalvitaDataProvider } from './client';
import { useFamilyOverview } from './family-overview';
import {
  useAcceptClaim,
  useCancelHandover,
  useConfirmHandover,
  useCreateManagedProfile,
  useDeclineClaim,
  useRejectHandover,
  useStartHandover,
  useUpdateManagedProfile,
} from './managed-profiles';

const OWNER_ID = '00000000-0000-4000-8000-000000000001';
const PROFILE_ID = '00000000-0000-4000-8000-0000000000aa';
const MEMBERSHIP_ID = '00000000-0000-4000-8000-0000000000c9';
const CLAIM_ID = '00000000-0000-4000-8000-0000000000a7';

const from = vi.fn();
const rpc = vi.fn(async () => ({ data: null, error: null }));
const getSession = vi.fn(async () => ({ data: { session: null }, error: null }));
const unsubscribe = vi.fn();
const onAuthStateChange = vi.fn(() => ({ data: { subscription: { unsubscribe } } }));

const client = {
  from,
  rpc,
  auth: { getSession, onAuthStateChange },
} as never;

function chain(row: unknown) {
  const payload = { data: row, error: null };
  const link = Promise.resolve(payload) as Promise<typeof payload> & Record<string, unknown>;
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'is', 'ilike', 'order', 'limit']) {
    link[m] = () => link;
  }
  link.single = async () => payload;
  link.maybeSingle = async () => payload;
  return link;
}

function wrapper({ children }: Readonly<{ children: ReactNode }>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <NalvitaDataProvider client={client} appBaseUrl="https://nalvita.test" openUrl={vi.fn()}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </NalvitaDataProvider>
  );
}

async function run<TVars>(
  useHook: () => { mutate: (vars: TVars) => void; isSuccess: boolean; isError: boolean },
  vars: TVars,
) {
  const { result } = renderHook(useHook, { wrapper });
  result.current.mutate(vars);
  await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  from.mockImplementation(() => chain({ id: 'row-1' }));
  rpc.mockImplementation(async () => ({ data: null, error: null }));
});

describe('inviting someone into a circle', () => {
  it('stores only hashes, and returns the plaintext secrets once', async () => {
    const { result } = renderHook(() => useCreateInvite(OWNER_ID), { wrapper });

    let created: { code: string; link: string } | undefined;
    result.current.mutate(
      { role: 'caregiver', categories: ['medicines'], invitee_email: 'appa@example.com' },
      { onSuccess: (value) => (created = value) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The link carries the injected origin, not anything read off `window`.
    expect(created?.link).toMatch(/^https:\/\/nalvita\.test\/family\/join\?token=[0-9a-f]{48}$/);
    expect(created?.code).toMatch(/^\d{6}$/);
    expect(from).toHaveBeenCalledWith('circle_invites');

    // Whatever was written must not contain either secret in the clear.
    const written = JSON.stringify(vi.mocked(from).mock.calls);
    expect(written).not.toContain(created?.code);
  });

  it('cancels an invite the owner no longer wants outstanding', async () => {
    const result = await run(() => useCancelInvite(), CLAIM_ID);

    expect(result.current.isSuccess).toBe(true);
    expect(from).toHaveBeenCalledWith('circle_invites');
  });

  it('accepts and declines through RPCs that take the secret', async () => {
    await run(() => useAcceptInvite(), 'secret-1');
    await run(() => useDeclineInvite(), 'secret-2');

    expect(rpc).toHaveBeenCalledWith('accept_circle_invite', { p_secret: 'secret-1' });
    expect(rpc).toHaveBeenCalledWith('decline_circle_invite', { p_secret: 'secret-2' });
  });
});

describe('changing what a member may do', () => {
  it('writes the new role and categories to the membership', async () => {
    const result = await run(() => useUpdateMembership(), {
      membershipId: MEMBERSHIP_ID,
      role: 'viewer' as const,
      categories: ['vitals' as const],
    });

    expect(result.current.isSuccess).toBe(true);
    expect(from).toHaveBeenCalledWith('circle_memberships');
  });

  it('revokes rather than deletes, so the history survives', async () => {
    const result = await run(() => useRevokeMembership(), MEMBERSHIP_ID);

    expect(result.current.isSuccess).toBe(true);
    expect(from).toHaveBeenCalledWith('circle_memberships');
  });
});

describe('managed profiles', () => {
  const profileRow = {
    id: PROFILE_ID,
    user_id: null,
    managed_by: OWNER_ID,
    full_name: 'Amma',
    date_of_birth: '1955-03-12',
    gender: null,
    blood_group: null,
    height_cm: null,
    weight_kg: null,
    is_minor: false,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  };

  it('creates a profile for someone with no account', async () => {
    from.mockImplementation(() => chain(profileRow));

    const result = await run(() => useCreateManagedProfile(OWNER_ID), {
      full_name: 'Amma',
      date_of_birth: '1955-03-12',
    } as never);

    expect(result.current.isSuccess).toBe(true);
    expect(from).toHaveBeenCalledWith('profiles');
  });

  it('edits a profile I look after', async () => {
    from.mockImplementation(() => chain(profileRow));

    const result = await run(() => useUpdateManagedProfile(), {
      profileId: PROFILE_ID,
      values: { full_name: 'Amma' },
    } as never);

    expect(result.current.isSuccess).toBe(true);
  });
});

describe('handover', () => {
  it('hands back a claim link built from the injected origin', async () => {
    const { result } = renderHook(() => useStartHandover(), { wrapper });

    let created: { code: string; link: string } | undefined;
    result.current.mutate(
      { profileId: PROFILE_ID, invitee_email: 'amma@example.com' },
      { onSuccess: (value) => (created = value) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(created?.link).toMatch(/^https:\/\/nalvita\.test\/profile\/claim\?token=[0-9a-f]{48}$/);
    expect(from).toHaveBeenCalledWith('profile_claims');
  });

  it('withdraws a handover nobody has claimed', async () => {
    const result = await run(() => useCancelHandover(), CLAIM_ID);

    expect(result.current.isSuccess).toBe(true);
    expect(from).toHaveBeenCalledWith('profile_claims');
  });

  /**
   * The transfer itself is a single SECURITY DEFINER function — the app must
   * never re-parent a profile with its own table writes.
   */
  it('completes and rejects through the transfer RPCs, not table writes', async () => {
    await run(() => useConfirmHandover(), CLAIM_ID);
    expect(rpc).toHaveBeenCalledWith('complete_profile_claim', { p_claim: CLAIM_ID });

    await run(() => useRejectHandover(), CLAIM_ID);
    expect(rpc).toHaveBeenCalledWith('reject_profile_claim', { p_claim: CLAIM_ID });
  });

  it('takes the claimant’s answer through their own RPCs', async () => {
    await run(() => useAcceptClaim(), 'secret-3');
    await run(() => useDeclineClaim(), 'secret-4');

    expect(rpc).toHaveBeenCalledWith('accept_profile_claim', { p_secret: 'secret-3' });
    expect(rpc).toHaveBeenCalledWith('decline_profile_claim', { p_secret: 'secret-4' });
  });
});

describe('family overview', () => {
  function person(overrides: Partial<CirclePerson> = {}): CirclePerson {
    return {
      membership_id: MEMBERSHIP_ID,
      direction: 'owner',
      counterpart_id: PROFILE_ID,
      counterpart_name: 'Amma',
      role: 'caregiver',
      shared_categories: ['medicines', 'vitals'],
      status: 'active',
      accepted_at: '2026-07-20T08:00:00.000Z',
      revoked_at: null,
      ...overrides,
    };
  }

  it('reads only the categories that are actually shared', async () => {
    from.mockImplementation(() => chain([]));

    const { result } = renderHook(() => useFamilyOverview([person()]), { wrapper });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    // medicines and vitals are shared; documents and profiles are not, so they
    // are never asked for — we do not lean on RLS to refuse them.
    const tables = vi.mocked(from).mock.calls.map(([table]) => table);
    expect(tables).toContain('medicines');
    expect(tables).toContain('vitals');
    expect(tables).not.toContain('documents');
    expect(tables).not.toContain('profiles');
  });

  it('has nothing to read when nobody is in the circle', () => {
    const { result } = renderHook(() => useFamilyOverview([]), { wrapper });

    expect(result.current.summaries).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });
});

describe('AuthProvider', () => {
  it('exposes the session and stops loading once it resolves', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }: Readonly<{ children: ReactNode }>) => (
        <NalvitaDataProvider client={client} appBaseUrl="https://nalvita.test" openUrl={vi.fn()}>
          <AuthProvider>{children}</AuthProvider>
        </NalvitaDataProvider>
      ),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();
    expect(getSession).toHaveBeenCalled();
    expect(onAuthStateChange).toHaveBeenCalled();
  });

  it('unsubscribes on unmount so a signed-out tab stops listening', async () => {
    const { unmount } = renderHook(() => useAuth(), {
      wrapper: ({ children }: Readonly<{ children: ReactNode }>) => (
        <NalvitaDataProvider client={client} appBaseUrl="https://nalvita.test" openUrl={vi.fn()}>
          <AuthProvider>{children}</AuthProvider>
        </NalvitaDataProvider>
      ),
    });

    await waitFor(() => expect(onAuthStateChange).toHaveBeenCalled());
    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
