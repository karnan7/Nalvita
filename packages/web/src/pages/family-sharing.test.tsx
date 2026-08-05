import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FamilySharingPage from './family-sharing';
import { supabase } from '@/lib/supabase';
import {
  makeAuditFeedRow,
  makeCirclePersonRow,
  makeInviteRow,
  makeSession,
} from '@/test/mocks/supabase';
import { renderWithProviders } from '@/test/render';

/** Captures the payload of every circle_memberships UPDATE the page issues. */
const membershipUpdate = vi.fn((payload: Record<string, unknown>) =>
  Promise.resolve({ error: null, payload }),
);

function stubCircle({
  people = [],
  invites = [],
  activity = [],
}: {
  people?: Record<string, unknown>[];
  invites?: Record<string, unknown>[];
  activity?: Record<string, unknown>[];
} = {}) {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: makeSession() },
    error: null,
  } as never);

  vi.mocked(supabase.rpc).mockImplementation((async (fn: string) => {
    if (fn === 'list_circle_people') return { data: people, error: null };
    if (fn === 'list_audit_feed') return { data: activity, error: null };
    return { data: null, error: null };
  }) as never);

  vi.mocked(supabase.from).mockImplementation(((table: string) => {
    if (table === 'circle_invites') {
      return {
        select: () => ({ eq: () => ({ order: async () => ({ data: invites, error: null }) }) }),
        delete: () => ({ eq: async () => ({ error: null }) }),
      };
    }
    if (table === 'circle_memberships') {
      return {
        update: (payload: Record<string, unknown>) => ({
          eq: async () => membershipUpdate(payload),
        }),
      };
    }
    return { select: () => ({ order: async () => ({ data: [], error: null }) }) };
  }) as never);
}

describe('FamilySharingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an empty state when no one is connected yet', async () => {
    stubCircle();
    renderWithProviders(<FamilySharingPage />, { route: '/family/sharing' });

    expect(await screen.findByText('No one yet')).toBeInTheDocument();
  });

  it('lists members with their role, categories and since when', async () => {
    stubCircle({ people: [makeCirclePersonRow()] });
    renderWithProviders(<FamilySharingPage />, { route: '/family/sharing' });

    expect(await screen.findByText('Appa')).toBeInTheDocument();
    expect(screen.getByText(/Can view and add/)).toBeInTheDocument();
    expect(screen.getByText(/Medicines and Vitals/)).toBeInTheDocument();
    expect(screen.getByText(/^Sharing since /)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove access' })).toBeInTheDocument();
  });

  it('asks for confirmation before removing a member', async () => {
    stubCircle({ people: [makeCirclePersonRow()] });
    const user = userEvent.setup();
    renderWithProviders(<FamilySharingPage />, { route: '/family/sharing' });

    await user.click(await screen.findByRole('button', { name: 'Remove access' }));
    expect(membershipUpdate).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog', { name: 'Remove access?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove access' }));
    expect(membershipUpdate).toHaveBeenCalledWith({ status: 'revoked' });
  });

  it('keeps access when the owner backs out of the confirmation', async () => {
    stubCircle({ people: [makeCirclePersonRow()] });
    const user = userEvent.setup();
    renderWithProviders(<FamilySharingPage />, { route: '/family/sharing' });

    await user.click(await screen.findByRole('button', { name: 'Remove access' }));
    await user.click(screen.getByRole('button', { name: 'Keep access' }));

    expect(membershipUpdate).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Remove access?' })).not.toBeInTheDocument();
  });

  it("changes a member's role and categories", async () => {
    stubCircle({ people: [makeCirclePersonRow()] });
    const user = userEvent.setup();
    renderWithProviders(<FamilySharingPage />, { route: '/family/sharing' });

    await user.click(await screen.findByRole('button', { name: 'Change access' }));
    const dialog = screen.getByRole('dialog', { name: 'Change what they can see' });

    // The dialog opens on what they have today, not on defaults.
    expect(within(dialog).getByLabelText('What they can do')).toHaveValue('caregiver');
    expect(within(dialog).getByLabelText('Medicines')).toBeChecked();
    expect(within(dialog).getByLabelText('Documents')).not.toBeChecked();

    await user.selectOptions(within(dialog).getByLabelText('What they can do'), 'viewer');
    await user.click(within(dialog).getByLabelText('Medicines'));
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(membershipUpdate).toHaveBeenCalledWith({
      role: 'viewer',
      shared_categories: ['vitals'],
    });
  });

  it('will not save an access change that shares nothing', async () => {
    stubCircle({ people: [makeCirclePersonRow({ shared_categories: ['vitals'] })] });
    const user = userEvent.setup();
    renderWithProviders(<FamilySharingPage />, { route: '/family/sharing' });

    await user.click(await screen.findByRole('button', { name: 'Change access' }));
    const dialog = screen.getByRole('dialog', { name: 'Change what they can see' });

    await user.click(within(dialog).getByLabelText('Vitals'));
    expect(within(dialog).getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('shows what other people did, in plain language', async () => {
    stubCircle({ people: [makeCirclePersonRow()], activity: [makeAuditFeedRow()] });
    renderWithProviders(<FamilySharingPage />, { route: '/family/sharing' });

    expect(await screen.findByText('Appa viewed your Blood test report')).toBeInTheDocument();
  });

  it('reassures the owner when nobody has done anything', async () => {
    stubCircle({ people: [makeCirclePersonRow()] });
    renderWithProviders(<FamilySharingPage />, { route: '/family/sharing' });

    expect(await screen.findByText('Nothing to show')).toBeInTheDocument();
  });

  it('shows pending invites the owner is waiting on', async () => {
    stubCircle({ invites: [makeInviteRow()] });
    renderWithProviders(<FamilySharingPage />, { route: '/family/sharing' });

    expect(await screen.findByText('appa@example.com')).toBeInTheDocument();
    expect(screen.getByText('Waiting')).toBeInTheDocument();
  });

  it('cancels a pending invite', async () => {
    stubCircle({ invites: [makeInviteRow()] });
    const user = userEvent.setup();
    renderWithProviders(<FamilySharingPage />, { route: '/family/sharing' });

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(supabase.from).toHaveBeenCalledWith('circle_invites');
  });

  it('gently marks a circle whose access has ended', async () => {
    stubCircle({
      people: [
        makeCirclePersonRow({
          direction: 'member',
          status: 'revoked',
          counterpart_name: 'Arjun',
        }),
      ],
    });
    renderWithProviders(<FamilySharingPage />, { route: '/family/sharing' });

    expect(await screen.findByText('Arjun')).toBeInTheDocument();
    expect(screen.getByText('This access has ended.')).toBeInTheDocument();
  });
});
