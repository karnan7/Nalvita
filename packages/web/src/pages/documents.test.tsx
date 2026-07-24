import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DocumentsPage from './documents';
import { supabase } from '@/lib/supabase';
import { makeDocumentRow, makeSession, stubDocumentsList } from '@/test/mocks/supabase';
import { renderWithProviders } from '@/test/render';

beforeEach(() => {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: makeSession() },
    error: null,
  } as never);
});

describe('DocumentsPage', () => {
  it('invites the person to upload when they have no documents', async () => {
    stubDocumentsList([]);
    renderWithProviders(<DocumentsPage />, { route: '/documents' });
    expect(await screen.findByText(/no documents yet/i)).toBeInTheDocument();
  });

  it('lists documents in the order the query returns them (newest first)', async () => {
    stubDocumentsList([
      makeDocumentRow({
        id: '00000000-0000-4000-8000-0000000000a1',
        title: 'Recent X-Ray',
        category: 'xray_scan',
      }),
      makeDocumentRow({
        id: '00000000-0000-4000-8000-0000000000b2',
        title: 'Older lab report',
        category: 'lab_report',
      }),
    ]);
    renderWithProviders(<DocumentsPage />, { route: '/documents' });

    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Recent X-Ray');
    expect(items[1]).toHaveTextContent('Older lab report');
  });

  it('filters by category when a chip is selected', async () => {
    stubDocumentsList([
      makeDocumentRow({
        id: '00000000-0000-4000-8000-0000000000a1',
        title: 'Recent X-Ray',
        category: 'xray_scan',
      }),
      makeDocumentRow({
        id: '00000000-0000-4000-8000-0000000000b2',
        title: 'Older lab report',
        category: 'lab_report',
      }),
    ]);
    const user = userEvent.setup();
    renderWithProviders(<DocumentsPage />, { route: '/documents' });

    await screen.findByText('Recent X-Ray');
    await user.click(screen.getByRole('button', { name: 'X-Ray / Scan' }));

    expect(screen.getByText('Recent X-Ray')).toBeInTheDocument();
    expect(screen.queryByText('Older lab report')).not.toBeInTheDocument();
  });

  it('searches by title or doctor/lab name', async () => {
    stubDocumentsList([
      makeDocumentRow({
        id: '00000000-0000-4000-8000-0000000000a1',
        title: 'Recent X-Ray',
        doctor_name: 'PVS Hospital',
      }),
      makeDocumentRow({
        id: '00000000-0000-4000-8000-0000000000b2',
        title: 'Older lab report',
        doctor_name: 'City Lab',
      }),
    ]);
    const user = userEvent.setup();
    renderWithProviders(<DocumentsPage />, { route: '/documents' });

    await screen.findByText('Recent X-Ray');
    await user.type(screen.getByPlaceholderText(/search by name or doctor/i), 'city');

    await waitFor(() =>
      expect(screen.queryByText('Recent X-Ray')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Older lab report')).toBeInTheDocument();
  });
});
