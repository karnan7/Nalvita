import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InviteDialog } from './invite-dialog';
import { supabase } from '@/lib/supabase';
import { makeSession } from '@/test/mocks/supabase';
import { renderWithProviders } from '@/test/render';

interface StubOptions {
  insertError?: unknown;
}

function stubInvites({ insertError = null }: StubOptions = {}) {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: makeSession() },
    error: null,
  } as never);

  const insert = vi.fn(() => ({
    select: () => ({ single: async () => ({ data: { id: 'inv-1' }, error: insertError }) }),
  }));
  const del = vi.fn(() => ({
    eq: () => ({ eq: () => ({ ilike: async () => ({ error: null }) }) }),
  }));
  vi.mocked(supabase.from).mockReturnValue({ insert, delete: del } as never);
  return { insert, del };
}

function renderDialog() {
  return renderWithProviders(<InviteDialog open onClose={vi.fn()} />, { route: '/family' });
}

describe('InviteDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an invite and reveals the code and link', async () => {
    stubInvites();
    const user = userEvent.setup();
    renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Create invite' }));

    expect(await screen.findByText('6-digit code')).toBeInTheDocument();
    expect(screen.getByText('Invite link')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('copies the generated link to the clipboard', async () => {
    stubInvites();
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    renderDialog();
    await user.click(await screen.findByRole('button', { name: 'Create invite' }));

    await user.click(await screen.findByRole('button', { name: 'Copy Invite link' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/family/join?token='));
  });

  it('lets the owner pick specific categories instead of all records', async () => {
    const { insert } = stubInvites();
    const user = userEvent.setup();
    renderDialog();

    await user.click(await screen.findByLabelText('All records'));
    await user.click(screen.getByLabelText('Medicines'));
    await user.click(screen.getByLabelText('Vitals'));
    await user.click(screen.getByRole('button', { name: 'Create invite' }));

    await screen.findByText('6-digit code');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ requested_categories: ['medicines', 'vitals'] }),
    );
  });

  it('removes an earlier pending invite when an email is given', async () => {
    const { del } = stubInvites();
    const user = userEvent.setup();
    renderDialog();

    await user.type(await screen.findByLabelText('Their email (optional)'), 'appa@example.com');
    await user.click(screen.getByRole('button', { name: 'Create invite' }));

    await screen.findByText('6-digit code');
    expect(del).toHaveBeenCalled();
  });

  it('shows a friendly error when the invite cannot be created', async () => {
    stubInvites({ insertError: { message: 'boom' } });
    const user = userEvent.setup();
    renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Create invite' }));
    expect(await screen.findByText(/we couldn't create this invite/i)).toBeInTheDocument();
  });
});
