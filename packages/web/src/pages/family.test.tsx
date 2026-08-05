import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FamilyPage from './family';
import { ViewingAsBanner } from '@/components/family/viewing-as-banner';
import { supabase } from '@/lib/supabase';
import {
  listBuilder,
  rowBuilder,
  makeCirclePersonRow,
  makeMedicineRow,
  makeProfileRow,
  makeSession,
  makeVitalRow,
} from '@/test/mocks/supabase';
import { renderWithProviders } from '@/test/render';

const APPA = '00000000-0000-4000-8000-000000000002';

/** A membership where I am the member — someone whose records I can help with. */
function inMyCare(overrides: Record<string, unknown> = {}) {
  return makeCirclePersonRow({
    direction: 'member',
    shared_categories: ['all'],
    counterpart_id: APPA,
    ...overrides,
  });
}

function stubFamily({
  people = [],
  medicines = [],
  vitals = [],
}: {
  people?: Record<string, unknown>[];
  medicines?: Record<string, unknown>[];
  vitals?: Record<string, unknown>[];
} = {}) {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: makeSession() },
    error: null,
  } as never);

  vi.mocked(supabase.rpc).mockImplementation((async (fn: string) => {
    if (fn === 'list_circle_people') return { data: people, error: null };
    return { data: [], error: null };
  }) as never);

  vi.mocked(supabase.from).mockImplementation(((table: string) => {
    if (table === 'profiles') {
      const row = makeProfileRow({ user_id: APPA, date_of_birth: '1962-04-01' });
      return rowBuilder(row);
    }
    if (table === 'medicines') return listBuilder(medicines);
    if (table === 'vitals') return listBuilder(vitals);
    return listBuilder([]);
  }) as never);
}

describe('FamilyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('points at the invite flow when nobody has shared with me', async () => {
    stubFamily();
    renderWithProviders(<FamilyPage />, { route: '/family' });

    expect(await screen.findByText('No one to look after')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Invite family member' })).toHaveAttribute(
      'href',
      '/family/sharing',
    );
  });

  it("summarises a person's medicines, latest reading and age", async () => {
    stubFamily({
      people: [inMyCare()],
      medicines: [makeMedicineRow({ user_id: APPA })],
      vitals: [makeVitalRow({ user_id: APPA, measured_at: new Date().toISOString() })],
    });
    renderWithProviders(<FamilyPage />, { route: '/family' });

    expect(await screen.findByText(/^Appa, \d+$/)).toBeInTheDocument();
    expect(screen.getByText('1 medicine')).toBeInTheDocument();
    expect(screen.getByText('128/84')).toBeInTheDocument();
  });

  it('raises a chip when nobody has taken a reading this week', async () => {
    stubFamily({
      people: [inMyCare()],
      medicines: [],
      vitals: [makeVitalRow({ user_id: APPA, measured_at: '2026-06-01T08:00:00.000Z' })],
    });
    renderWithProviders(<FamilyPage />, { route: '/family' });

    expect(await screen.findByText('No readings this week')).toBeInTheDocument();
  });

  it('leaves out what has not been shared with me', async () => {
    stubFamily({
      people: [inMyCare({ shared_categories: ['vitals'] })],
      vitals: [makeVitalRow({ user_id: APPA, measured_at: new Date().toISOString() })],
    });
    renderWithProviders(<FamilyPage />, { route: '/family' });

    expect(await screen.findByText('128/84')).toBeInTheDocument();
    expect(screen.queryByText(/medicine/)).not.toBeInTheDocument();
  });

  it('ignores circles whose access has been revoked', async () => {
    stubFamily({ people: [inMyCare({ status: 'revoked' })] });
    renderWithProviders(<FamilyPage />, { route: '/family' });

    expect(await screen.findByText('No one to look after')).toBeInTheDocument();
  });

  it('does not list the people who can see my own records', async () => {
    stubFamily({ people: [makeCirclePersonRow({ direction: 'owner' })] });
    renderWithProviders(<FamilyPage />, { route: '/family' });

    expect(await screen.findByText('No one to look after')).toBeInTheDocument();
  });

  it('switches into their records, and says so, when their card is chosen', async () => {
    stubFamily({
      people: [inMyCare()],
      vitals: [makeVitalRow({ user_id: APPA, measured_at: new Date().toISOString() })],
    });
    const user = userEvent.setup();
    // Rendered together so the click travels through the real context: the
    // banner is what tells someone they have left their own account.
    renderWithProviders(
      <>
        <ViewingAsBanner />
        <FamilyPage />
      </>,
      { route: '/family' },
    );

    expect(screen.queryByText(/You're in/)).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /Appa/ }));

    expect(await screen.findByText(/You're in Appa's records/)).toBeInTheDocument();
  });

  it('returns me to my own records from the banner', async () => {
    stubFamily({
      people: [inMyCare()],
      vitals: [makeVitalRow({ user_id: APPA, measured_at: new Date().toISOString() })],
    });
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <ViewingAsBanner />
        <FamilyPage />
      </>,
      { route: '/family' },
    );

    await user.click(await screen.findByRole('button', { name: /Appa/ }));
    await user.click(screen.getByRole('button', { name: 'Back to my records' }));

    expect(screen.queryByText(/You're in Appa's records/)).not.toBeInTheDocument();
  });
});
