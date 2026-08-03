import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import JoinInvitePage from './join-invite';
import { supabase } from '@/lib/supabase';
import { makeInvitePreviewRow, makeSession } from '@/test/mocks/supabase';
import { renderWithProviders } from '@/test/render';

function signedIn() {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: makeSession() },
    error: null,
  } as never);
}

function stubRpc(handlers: Record<string, unknown>) {
  vi.mocked(supabase.rpc).mockImplementation((async (fn: string) => {
    if (fn in handlers) return handlers[fn];
    return { data: null, error: null };
  }) as never);
}

describe('JoinInvitePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('asks an unauthenticated visitor to sign in, preserving the invite', async () => {
    renderWithProviders(<JoinInvitePage />, { route: '/family/join?token=tok123' });

    expect(await screen.findByText("You've been invited")).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Sign in to continue' });
    expect(link).toHaveAttribute(
      'href',
      `/login?redirect=${encodeURIComponent('/family/join?token=tok123')}`,
    );
  });

  it('shows the consent details and accepts the invite', async () => {
    signedIn();
    stubRpc({
      preview_circle_invite: { data: [makeInvitePreviewRow()], error: null },
      accept_circle_invite: { data: null, error: null },
    });
    const user = userEvent.setup();
    renderWithProviders(<JoinInvitePage />, { route: '/family/join?token=tok123' });

    expect(
      await screen.findByText(/Arjun wants to add you to their Health Circle/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Medicines and Vitals/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Accept' }));

    expect(await screen.findByText("You're connected")).toBeInTheDocument();
    expect(supabase.rpc).toHaveBeenCalledWith('accept_circle_invite', { p_secret: 'tok123' });
  });

  it('declines without creating a connection', async () => {
    signedIn();
    stubRpc({
      preview_circle_invite: { data: [makeInvitePreviewRow()], error: null },
      decline_circle_invite: { data: null, error: null },
    });
    const user = userEvent.setup();
    renderWithProviders(<JoinInvitePage />, { route: '/family/join?token=tok123' });

    await user.click(await screen.findByRole('button', { name: 'Decline' }));

    expect(await screen.findByText('Invite declined')).toBeInTheDocument();
    expect(supabase.rpc).toHaveBeenCalledWith('decline_circle_invite', { p_secret: 'tok123' });
  });

  it('lets someone without the link type a 6-digit code', async () => {
    signedIn();
    stubRpc({ preview_circle_invite: { data: [makeInvitePreviewRow()], error: null } });
    const user = userEvent.setup();
    renderWithProviders(<JoinInvitePage />, { route: '/family/join' });

    await user.type(await screen.findByLabelText('Enter your invite code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByText(/Arjun wants to add you to their Health Circle/),
    ).toBeInTheDocument();
    expect(supabase.rpc).toHaveBeenCalledWith('preview_circle_invite', { p_secret: '123456' });
  });

  it('explains when the invite is invalid or expired', async () => {
    signedIn();
    stubRpc({
      preview_circle_invite: { data: null, error: { message: 'This invite has expired.' } },
    });
    renderWithProviders(<JoinInvitePage />, { route: '/family/join?token=badtoken' });

    expect(await screen.findByText('Invite not found')).toBeInTheDocument();
  });
});
