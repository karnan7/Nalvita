import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FamilyPage from './family';
import { supabase } from '@/lib/supabase';
import {
  makeCirclePersonRow,
  makeInviteRow,
  makeSession,
} from '@/test/mocks/supabase';
import { renderWithProviders } from '@/test/render';

function stubCircle({
  people = [],
  invites = [],
}: {
  people?: Record<string, unknown>[];
  invites?: Record<string, unknown>[];
} = {}) {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: makeSession() },
    error: null,
  } as never);

  vi.mocked(supabase.rpc).mockImplementation((async (fn: string) => {
    if (fn === 'list_circle_people') return { data: people, error: null };
    return { data: null, error: null };
  }) as never);

  vi.mocked(supabase.from).mockImplementation(((table: string) => {
    if (table === 'circle_invites') {
      return {
        select: () => ({ eq: () => ({ order: async () => ({ data: invites, error: null }) }) }),
      };
    }
    if (table === 'circle_memberships') {
      return { update: () => ({ eq: async () => ({ error: null }) }) };
    }
    return { select: () => ({ order: async () => ({ data: [], error: null }) }) };
  }) as never);
}

describe('FamilyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an empty state when no one is connected yet', async () => {
    stubCircle();
    renderWithProviders(<FamilyPage />, { route: '/family' });

    expect(await screen.findByText('No one yet')).toBeInTheDocument();
  });

  it('lists members with their role and a way to remove access', async () => {
    stubCircle({ people: [makeCirclePersonRow()] });
    renderWithProviders(<FamilyPage />, { route: '/family' });

    expect(await screen.findByText('Appa')).toBeInTheDocument();
    expect(screen.getByText(/Can view and add/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove access' })).toBeInTheDocument();
  });

  it('revokes access when the owner removes a member', async () => {
    stubCircle({ people: [makeCirclePersonRow()] });
    const user = userEvent.setup();
    renderWithProviders(<FamilyPage />, { route: '/family' });

    await user.click(await screen.findByRole('button', { name: 'Remove access' }));
    expect(supabase.from).toHaveBeenCalledWith('circle_memberships');
  });

  it('shows pending invites the owner is waiting on', async () => {
    stubCircle({ invites: [makeInviteRow()] });
    renderWithProviders(<FamilyPage />, { route: '/family' });

    expect(await screen.findByText('appa@example.com')).toBeInTheDocument();
    expect(screen.getByText('Waiting')).toBeInTheDocument();
  });

  it('gently marks a circle whose access has ended', async () => {
    stubCircle({
      people: [makeCirclePersonRow({ direction: 'member', status: 'revoked', counterpart_name: 'Arjun' })],
    });
    renderWithProviders(<FamilyPage />, { route: '/family' });

    expect(await screen.findByText('Arjun')).toBeInTheDocument();
    expect(screen.getByText('This access has ended.')).toBeInTheDocument();
  });
});
