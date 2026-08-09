import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ClaimProfilePage from './claim-profile';
import { supabase } from '@/lib/supabase';
import { makeSession } from '@/test/mocks/supabase';
import { renderWithProviders } from '@/test/render';

const TOKEN = 'a'.repeat(48);

function makePreview(overrides: Record<string, unknown> = {}) {
  return {
    profile_id: '00000000-0000-4000-8000-0000000000ab',
    profile_name: 'Amma',
    date_of_birth: '1955-03-12',
    manager_name: 'Arjun',
    record_count: 24,
    expires_at: '2026-08-10T10:00:00.000Z',
    already_claimed: false,
    ...overrides,
  };
}

function stubClaim({
  signedIn = true,
  preview = [makePreview()],
  previewError = null,
  onCall = vi.fn(),
}: {
  signedIn?: boolean;
  preview?: Record<string, unknown>[];
  previewError?: { message: string } | null;
  onCall?: ReturnType<typeof vi.fn>;
} = {}) {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: signedIn ? makeSession() : null },
    error: null,
  } as never);

  vi.mocked(supabase.rpc).mockImplementation((async (fn: string, args: unknown) => {
    onCall(fn, args);
    if (fn === 'preview_profile_claim') return { data: preview, error: previewError };
    return { data: null, error: null };
  }) as never);
}

describe('ClaimProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('asks them to sign in before revealing anything about the profile', async () => {
    stubClaim({ signedIn: false });
    renderWithProviders(<ClaimProfilePage />, { route: `/profile/claim?token=${TOKEN}` });

    expect(await screen.findByText('Your health records')).toBeInTheDocument();
    expect(screen.queryByText('Amma, 71')).not.toBeInTheDocument();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('returns them to the same link after signing in', async () => {
    stubClaim({ signedIn: false });
    renderWithProviders(<ClaimProfilePage />, { route: `/profile/claim?token=${TOKEN}` });

    const link = await screen.findByRole('link', { name: 'Sign in to continue' });
    expect(link).toHaveAttribute(
      'href',
      `/login?redirect=${encodeURIComponent(`/profile/claim?token=${TOKEN}`)}`,
    );
  });

  it('shows who is handing over, and how much, without any of the records', async () => {
    stubClaim();
    renderWithProviders(<ClaimProfilePage />, { route: `/profile/claim?token=${TOKEN}` });

    expect(
      await screen.findByText('Arjun wants to hand these records to you'),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Amma, \d+$/)).toBeInTheDocument();
    expect(screen.getByText('24 records')).toBeInTheDocument();
  });

  it('says the handover still needs the other side', async () => {
    stubClaim();
    renderWithProviders(<ClaimProfilePage />, { route: `/profile/claim?token=${TOKEN}` });

    expect(
      await screen.findByText(/Arjun will be asked to confirm it's you before anything moves/),
    ).toBeInTheDocument();
  });

  it('accepts with the secret, and does not pretend the profile has moved', async () => {
    const onCall = vi.fn();
    stubClaim({ onCall });
    const user = userEvent.setup();
    renderWithProviders(<ClaimProfilePage />, { route: `/profile/claim?token=${TOKEN}` });

    await user.click(await screen.findByRole('button', { name: 'Yes, this is me' }));

    expect(onCall).toHaveBeenCalledWith('accept_profile_claim', { p_secret: TOKEN });
    expect(await screen.findByText('Almost there')).toBeInTheDocument();
  });

  it('declines without moving anything', async () => {
    const onCall = vi.fn();
    stubClaim({ onCall });
    const user = userEvent.setup();
    renderWithProviders(<ClaimProfilePage />, { route: `/profile/claim?token=${TOKEN}` });

    await user.click(await screen.findByRole('button', { name: 'Not me' }));

    expect(onCall).toHaveBeenCalledWith('decline_profile_claim', { p_secret: TOKEN });
    expect(await screen.findByText('No problem')).toBeInTheDocument();
  });

  it('tells someone who has already claimed that it is with the other side', async () => {
    stubClaim({ preview: [makePreview({ already_claimed: true })] });
    renderWithProviders(<ClaimProfilePage />, { route: `/profile/claim?token=${TOKEN}` });

    expect(await screen.findByText('Waiting on them')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Yes, this is me' })).not.toBeInTheDocument();
  });

  it('does not say the link is valid when it is not', async () => {
    stubClaim({ preview: [], previewError: { message: 'This claim code is not valid.' } });
    renderWithProviders(<ClaimProfilePage />, { route: `/profile/claim?token=${TOKEN}` });

    expect(await screen.findByText('Link not found')).toBeInTheDocument();
  });

  it('offers manual code entry when there is no link', async () => {
    stubClaim();
    renderWithProviders(<ClaimProfilePage />, { route: '/profile/claim' });

    expect(await screen.findByLabelText('Enter your code')).toBeInTheDocument();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('looks up a typed code as the secret it is', async () => {
    const onCall = vi.fn();
    stubClaim({ onCall });
    const user = userEvent.setup();
    renderWithProviders(<ClaimProfilePage />, { route: '/profile/claim' });

    await user.type(await screen.findByLabelText('Enter your code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onCall).toHaveBeenCalledWith('preview_profile_claim', { p_secret: '123456' });
  });

  it('names the profile plainly when nobody has filled in a name', async () => {
    stubClaim({
      preview: [makePreview({ profile_name: null, manager_name: null, record_count: 0 })],
    });
    renderWithProviders(<ClaimProfilePage />, { route: `/profile/claim?token=${TOKEN}` });

    expect(
      await screen.findByText('A family member wants to hand these records to you'),
    ).toBeInTheDocument();
    expect(screen.getByText('No records yet')).toBeInTheDocument();
  });
});
