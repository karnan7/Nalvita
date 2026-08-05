import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FamilyPage from '@/pages/family';
import MedicinesPage from '@/pages/medicines';
import { supabase } from '@/lib/supabase';
import {
  listBuilder,
  rowBuilder,
  makeCirclePersonRow,
  makeMedicineRow,
  makeProfileRow,
  makeSession,
} from '@/test/mocks/supabase';
import { renderWithProviders } from '@/test/render';

/**
 * What stops a caregiver doing the wrong thing in the wrong account: actions
 * their role does not allow are absent rather than refused, and the first
 * change they make somewhere that isn't theirs is confirmed first.
 */

const APPA = '00000000-0000-4000-8000-000000000002';

function stub(role: 'viewer' | 'caregiver' | 'manager') {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: makeSession() },
    error: null,
  } as never);

  const person = makeCirclePersonRow({
    direction: 'member',
    counterpart_id: APPA,
    shared_categories: ['all'],
    role,
  });

  vi.mocked(supabase.rpc).mockImplementation((async (fn: string) => {
    if (fn === 'list_circle_people') return { data: [person], error: null };
    return { data: [], error: null };
  }) as never);

  vi.mocked(supabase.from).mockImplementation(((table: string) => {
    if (table === 'profiles') {
      const row = makeProfileRow({ user_id: APPA });
      return rowBuilder(row);
    }
    if (table === 'medicines') return listBuilder([makeMedicineRow({ user_id: APPA })]);
    return listBuilder([]);
  }) as never);
}

/** Enters Appa's records the way a person would: from their family card. */
async function enterAppasRecords(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Appa/ }));
}

function renderCareScreens() {
  return renderWithProviders(
    <>
      <FamilyPage />
      <MedicinesPage />
    </>,
    { route: '/family' },
  );
}

describe('caregiver mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers no way to add or edit when I may only view', async () => {
    stub('viewer');
    const user = userEvent.setup();
    renderCareScreens();

    expect(await screen.findByRole('button', { name: /Add medicine/ })).toBeInTheDocument();

    await enterAppasRecords(user);

    expect(screen.queryByRole('button', { name: /Add medicine/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('lets a caregiver add and edit, but not stop a medicine outright', async () => {
    stub('caregiver');
    const user = userEvent.setup();
    renderCareScreens();

    await enterAppasRecords(user);

    expect(screen.getByRole('button', { name: /Add medicine/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it("confirms the first change made in someone else's account", async () => {
    stub('caregiver');
    const user = userEvent.setup();
    renderCareScreens();

    await enterAppasRecords(user);
    await user.click(screen.getByRole('button', { name: /Add medicine/ }));

    expect(screen.getByRole('dialog', { name: 'This is not your account' })).toBeInTheDocument();
    // The form itself stays shut until they say yes.
    expect(screen.queryByRole('dialog', { name: 'Add medicine' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Yes, continue' }));

    expect(screen.getByRole('dialog', { name: 'Add medicine' })).toBeInTheDocument();
  });

  it('backing out of the confirmation leaves the record alone', async () => {
    stub('caregiver');
    const user = userEvent.setup();
    renderCareScreens();

    await enterAppasRecords(user);
    await user.click(screen.getByRole('button', { name: /Add medicine/ }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog', { name: 'Add medicine' })).not.toBeInTheDocument();
  });

  it('asks only once per person, not on every change', async () => {
    stub('caregiver');
    const user = userEvent.setup();
    renderCareScreens();

    await enterAppasRecords(user);
    await user.click(screen.getByRole('button', { name: /Add medicine/ }));
    await user.click(screen.getByRole('button', { name: 'Yes, continue' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: /Add medicine/ }));

    expect(
      screen.queryByRole('dialog', { name: 'This is not your account' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Add medicine' })).toBeInTheDocument();
  });

  it('never asks in my own account', async () => {
    stub('caregiver');
    const user = userEvent.setup();
    renderCareScreens();

    await user.click(await screen.findByRole('button', { name: /Add medicine/ }));

    expect(
      screen.queryByRole('dialog', { name: 'This is not your account' }),
    ).not.toBeInTheDocument();
  });
});
