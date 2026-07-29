import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TimelinePage from './timeline';
import { supabase } from '@/lib/supabase';
import {
  makeConditionRow,
  makeDocumentRow,
  makeMedicineRow,
  makeSession,
  makeVitalRow,
  stubTables,
} from '@/test/mocks/supabase';
import { renderWithProviders } from '@/test/render';

beforeEach(() => {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: makeSession() },
    error: null,
  } as never);
});

describe('TimelinePage', () => {
  it('shows events from every source, each linking to its section', async () => {
    stubTables({
      documents: [makeDocumentRow({ title: 'Chest X-ray', doc_date: '2026-07-20' })],
      medicines: [makeMedicineRow({ name: 'Amlodipine', start_date: '2026-07-18' })],
      vitals: [makeVitalRow({ measured_at: '2026-07-22T08:00:00.000Z' })],
      conditions: [makeConditionRow({ name: 'Hypertension', diagnosis_date: '2026-07-15' })],
    });
    renderWithProviders(<TimelinePage />, { route: '/timeline' });

    const xray = await screen.findByText('Chest X-ray');
    expect(xray.closest('a')).toHaveAttribute('href', '/documents');
    expect(screen.getByText('Started Amlodipine').closest('a')).toHaveAttribute('href', '/medicines');
    expect(screen.getByText('Diagnosed with Hypertension').closest('a')).toHaveAttribute(
      'href',
      '/profile',
    );
    expect(screen.getByText('Blood pressure').closest('a')).toHaveAttribute('href', '/vitals');
  });

  it('filters the feed by event type', async () => {
    stubTables({
      documents: [makeDocumentRow({ title: 'Chest X-ray', doc_date: '2026-07-20' })],
      medicines: [makeMedicineRow({ name: 'Amlodipine', start_date: '2026-07-18' })],
    });
    renderWithProviders(<TimelinePage />, { route: '/timeline' });

    await screen.findByText('Chest X-ray');
    await userEvent.click(screen.getByRole('button', { name: 'Medicines' }));

    expect(screen.queryByText('Chest X-ray')).not.toBeInTheDocument();
    expect(screen.getByText('Started Amlodipine')).toBeInTheDocument();
  });

  it('reveals more entries when Load more is pressed', async () => {
    const documents = Array.from({ length: 35 }, (_, i) =>
      makeDocumentRow({
        id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        title: `Report ${i}`,
        doc_date: '2026-07-20',
      }),
    );
    stubTables({ documents });
    renderWithProviders(<TimelinePage />, { route: '/timeline' });

    await screen.findByText('Report 0');
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(30);

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(35);
  });

  it('invites the user to add records when there is nothing yet', async () => {
    stubTables({});
    renderWithProviders(<TimelinePage />, { route: '/timeline' });

    expect(await screen.findByText(/your health events will appear here/i)).toBeInTheDocument();
  });
});
