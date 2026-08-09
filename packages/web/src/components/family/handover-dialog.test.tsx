import type { Profile } from '@nalvita/core';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HandoverDialog } from './handover-dialog';
import { supabase } from '@/lib/supabase';
import { renderWithProviders } from '@/test/render';

const PROFILE_ID = '00000000-0000-4000-8000-0000000000ab';
const CLAIM_ID = '00000000-0000-4000-8000-0000000000c1';

const amma: Profile = {
  id: PROFILE_ID,
  user_id: null,
  managed_by: '00000000-0000-4000-8000-000000000001',
  full_name: 'Amma',
  date_of_birth: '1955-03-12',
  gender: 'female',
  blood_group: 'O+',
  height_cm: null,
  weight_kg: null,
  is_minor: false,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
};

interface ClaimInsertChain {
  select: () => { single: () => Promise<{ data: { id: string }; error: null }> };
}

function makeClaim(overrides: Record<string, unknown> = {}) {
  return {
    id: CLAIM_ID,
    profile_id: PROFILE_ID,
    profile_name: 'Amma',
    status: 'pending',
    invitee_email: null,
    claimant_name: null,
    claimed_at: null,
    expires_at: '2026-08-10T10:00:00.000Z',
    created_at: '2026-08-07T09:00:00.000Z',
    ...overrides,
  };
}

function stubHandover({
  claims = [] as Record<string, unknown>[],
  onCall = vi.fn(),
} = {}) {
  vi.mocked(supabase.rpc).mockImplementation((async (fn: string, args: unknown) => {
    onCall(fn, args);
    if (fn === 'list_profile_claims') return { data: claims, error: null };
    return { data: null, error: null };
  }) as never);

  const inserted = { select: () => ({ single: async () => ({ data: { id: CLAIM_ID }, error: null }) }) };
  vi.mocked(supabase.from).mockReturnValue({
    insert: () => inserted,
    delete: () => ({ eq: async () => ({ data: null, error: null }) }),
  } as never);

  return onCall;
}

describe('HandoverDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('explains what the person gets and what the manager keeps', async () => {
    stubHandover();
    renderWithProviders(<HandoverDialog open onClose={vi.fn()} profile={amma} />);

    expect(await screen.findByText(/You stay on as a caregiver/)).toBeInTheDocument();
  });

  it('shows the code and link once, and only after they are created', async () => {
    stubHandover();
    const user = userEvent.setup();
    renderWithProviders(<HandoverDialog open onClose={vi.fn()} profile={amma} />);

    expect(screen.queryByText('Claim link')).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Create claim link' }));

    expect(await screen.findByText('Claim link')).toBeInTheDocument();
    expect(screen.getByText('6-digit code')).toBeInTheDocument();
  });

  it('never sends a plaintext secret to the database', async () => {
    stubHandover();
    const user = userEvent.setup();
    // Typed by its signature rather than its implementation, so `mock.calls`
    // knows the row was an argument even though the stub ignores it.
    const insert = vi.fn<(row: Record<string, unknown>) => ClaimInsertChain>(() => ({
      select: () => ({ single: async () => ({ data: { id: CLAIM_ID }, error: null }) }),
    }));
    vi.mocked(supabase.from).mockReturnValue({
      insert,
      delete: () => ({ eq: async () => ({ data: null, error: null }) }),
    } as never);

    renderWithProviders(<HandoverDialog open onClose={vi.fn()} profile={amma} />);
    await user.click(await screen.findByRole('button', { name: 'Create claim link' }));

    await screen.findByText('Claim link');
    const row = insert.mock.calls[0]?.[0];
    if (!row) throw new Error('No claim was inserted.');
    // Both hashes are stored; the plaintext exists only on screen.
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.code_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(row)).not.toContain('token');
    expect(Object.keys(row)).not.toContain('code');
  });

  it('offers to withdraw a claim nobody has picked up', async () => {
    stubHandover({ claims: [makeClaim()] });
    renderWithProviders(<HandoverDialog open onClose={vi.fn()} profile={amma} />);

    expect(await screen.findByRole('button', { name: 'Withdraw invitation' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm handover' })).not.toBeInTheDocument();
  });

  it('asks the manager to confirm once someone has claimed, naming them', async () => {
    stubHandover({
      claims: [makeClaim({ status: 'awaiting_manager', claimant_name: 'Meera' })],
    });
    renderWithProviders(<HandoverDialog open onClose={vi.fn()} profile={amma} />);

    expect(await screen.findByText(/Meera/)).toBeInTheDocument();
    expect(screen.getByText(/Only confirm if you recognise this person/)).toBeInTheDocument();
  });

  it('transfers only when the manager confirms', async () => {
    const onCall = stubHandover({
      claims: [makeClaim({ status: 'awaiting_manager', claimant_name: 'Meera' })],
    });
    const user = userEvent.setup();
    renderWithProviders(<HandoverDialog open onClose={vi.fn()} profile={amma} />);

    await user.click(await screen.findByRole('button', { name: 'Confirm handover' }));

    expect(onCall).toHaveBeenCalledWith('complete_profile_claim', { p_claim: CLAIM_ID });
  });

  it('lets the manager refuse a claimant they do not recognise', async () => {
    const onCall = stubHandover({
      claims: [makeClaim({ status: 'awaiting_manager', claimant_name: 'Meera' })],
    });
    const user = userEvent.setup();
    renderWithProviders(<HandoverDialog open onClose={vi.fn()} profile={amma} />);

    await user.click(await screen.findByRole('button', { name: "That's not them" }));

    expect(onCall).toHaveBeenCalledWith('reject_profile_claim', { p_claim: CLAIM_ID });
    expect(onCall).not.toHaveBeenCalledWith('complete_profile_claim', expect.anything());
  });

  it('ignores a claim belonging to a different profile', async () => {
    stubHandover({
      claims: [
        makeClaim({
          profile_id: '00000000-0000-4000-8000-0000000000ac',
          status: 'awaiting_manager',
          claimant_name: 'Someone else',
        }),
      ],
    });
    renderWithProviders(<HandoverDialog open onClose={vi.fn()} profile={amma} />);

    expect(await screen.findByRole('button', { name: 'Create claim link' })).toBeInTheDocument();
    expect(screen.queryByText('Someone else')).not.toBeInTheDocument();
  });
});
