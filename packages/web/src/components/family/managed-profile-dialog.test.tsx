import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ManagedProfileDialog } from './managed-profile-dialog';
import { supabase } from '@/lib/supabase';
import { makeManagedProfileRow, makeSession } from '@/test/mocks/supabase';
import { renderWithProviders } from '@/test/render';

interface InsertChain {
  select: () => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
}

/** Captures the row handed to `.insert()`, returning it as PostgREST would. */
function stubInsert(result: { data?: unknown; error?: { message: string } | null } = {}) {
  // Typed by its signature rather than its implementation, so `mock.calls`
  // knows the row was an argument even though the stub ignores it.
  const insert = vi.fn<(row: Record<string, unknown>) => InsertChain>(() => ({
    select: () => ({
      single: async () => ({
        data: result.data ?? makeManagedProfileRow(),
        error: result.error ?? null,
      }),
    }),
  }));
  vi.mocked(supabase.from).mockReturnValue({ insert } as never);
  return insert;
}

/** The row the dialog actually sent, failing the test if it never sent one. */
function insertedRow(insert: ReturnType<typeof stubInsert>): Record<string, unknown> {
  const row = insert.mock.calls[0]?.[0];
  if (!row) throw new Error('Nothing was inserted.');
  return row;
}

function render(profile: ReturnType<typeof makeManagedProfileRow> | null = null) {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: makeSession() },
    error: null,
  } as never);
  return renderWithProviders(
    <ManagedProfileDialog
      open
      onClose={vi.fn()}
      profile={profile as never}
    />,
  );
}

describe('ManagedProfileDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('says plainly that no login is needed', async () => {
    stubInsert();
    render();

    expect(await screen.findByText(/They don't need an email or a login/)).toBeInTheDocument();
  });

  it('cannot be submitted without a name', async () => {
    stubInsert();
    render();

    expect(await screen.findByRole('button', { name: 'Add profile' })).toBeDisabled();
  });

  it('creates the profile under my account, with no user of its own', async () => {
    const insert = stubInsert();
    const user = userEvent.setup();
    render();

    await user.type(await screen.findByLabelText('Their name'), 'Amma');
    await user.click(screen.getByRole('button', { name: 'Add profile' }));

    const row = insertedRow(insert);
    expect(row.full_name).toBe('Amma');
    expect(row.managed_by).toBe(makeSession().user.id);
    expect(row).not.toHaveProperty('user_id');
  });

  it('records a child as one', async () => {
    const insert = stubInsert();
    const user = userEvent.setup();
    render();

    await user.type(await screen.findByLabelText('Their name'), 'Kiran');
    await user.click(screen.getByLabelText(/This is a child/));
    await user.click(screen.getByRole('button', { name: 'Add profile' }));

    expect(insertedRow(insert).is_minor).toBe(true);
  });

  it('defaults to an adult', async () => {
    const insert = stubInsert();
    const user = userEvent.setup();
    render();

    await user.type(await screen.findByLabelText('Their name'), 'Amma');
    await user.click(screen.getByRole('button', { name: 'Add profile' }));

    expect(insertedRow(insert).is_minor).toBe(false);
  });

  it("passes the database's own words through when the cap is hit", async () => {
    stubInsert({ error: { message: 'You can look after up to 6 profiles.' } });
    const user = userEvent.setup();
    render();

    await user.type(await screen.findByLabelText('Their name'), 'One too many');
    await user.click(screen.getByRole('button', { name: 'Add profile' }));

    expect(await screen.findByText('You can look after up to 6 profiles.')).toBeInTheDocument();
  });

  it('edits an existing profile rather than adding another', async () => {
    const update = vi.fn(() => ({
      eq: () => ({
        select: () => ({ single: async () => ({ data: makeManagedProfileRow(), error: null }) }),
      }),
    }));
    vi.mocked(supabase.from).mockReturnValue({ update } as never);
    const user = userEvent.setup();
    render(makeManagedProfileRow());

    expect(await screen.findByDisplayValue('Amma')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save details' }));

    expect(update).toHaveBeenCalledOnce();
  });
});
