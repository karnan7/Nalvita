import { documentSchema } from '@nalvita/core';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentCard } from './document-card';
import { supabase } from '@/lib/supabase';
import { makeDocumentRow, makeSession } from '@/test/mocks/supabase';
import { renderWithProviders } from '@/test/render';

const doc = documentSchema.parse(makeDocumentRow({ title: 'Blood test report' }));

beforeEach(() => {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: makeSession() },
    error: null,
  } as never);
});

describe('DocumentCard', () => {
  it('asks for confirmation before deleting, then deletes the row', async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const del = vi.fn(() => ({ eq }));
    vi.mocked(supabase.from).mockReturnValue({ delete: del } as never);
    const remove = vi.fn(async () => ({ data: [], error: null }));
    vi.mocked(supabase.storage.from).mockReturnValue({ remove } as never);

    const user = userEvent.setup();
    renderWithProviders(
      <ul>
        <DocumentCard doc={doc} onView={() => {}} />
      </ul>,
    );

    expect(screen.queryByText(/cannot be undone/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Blood test report' }));
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    expect(del).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(del).toHaveBeenCalled());
    expect(eq).toHaveBeenCalledWith('id', doc.id);
  });

  it('shows the category, doctor, and date as plain text', () => {
    renderWithProviders(
      <ul>
        <DocumentCard doc={doc} onView={() => {}} />
      </ul>,
    );
    expect(screen.getByText(/Lab Report/)).toBeInTheDocument();
    expect(screen.getByText(/City Lab/)).toBeInTheDocument();
  });
});
