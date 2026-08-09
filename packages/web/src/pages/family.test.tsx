import { MAX_MANAGED_PROFILES } from '@nalvita/core';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FamilyPage from './family';
import { ViewingAsBanner } from '@/components/family/viewing-as-banner';
import { supabase } from '@/lib/supabase';
import {
  listBuilder,
  makeCirclePersonRow,
  makeManagedProfileRow,
  makeMedicineRow,
  makeProfileRow,
  makeSession,
  makeVitalRow,
  profilesBuilder,
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

/** Appa's own profile row, reachable by id because he shares 'profiles' with me. */
const appaProfile = makeProfileRow({
  id: APPA,
  user_id: APPA,
  full_name: 'Appa',
  date_of_birth: '1962-04-01',
});

function stubFamily({
  people = [],
  medicines = [],
  vitals = [],
  managed = [],
  claims = [],
}: {
  people?: Record<string, unknown>[];
  medicines?: Record<string, unknown>[];
  vitals?: Record<string, unknown>[];
  managed?: Record<string, unknown>[];
  claims?: Record<string, unknown>[];
} = {}) {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: makeSession() },
    error: null,
  } as never);

  vi.mocked(supabase.rpc).mockImplementation((async (fn: string) => {
    if (fn === 'list_circle_people') return { data: people, error: null };
    if (fn === 'list_profile_claims') return { data: claims, error: null };
    return { data: [], error: null };
  }) as never);

  vi.mocked(supabase.from).mockImplementation(((table: string) => {
    if (table === 'profiles') {
      return profilesBuilder({ self: makeProfileRow(), managed, others: [appaProfile] });
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

  describe('profiles I look after', () => {
    it('lists them as mine, with their age', async () => {
      stubFamily({ managed: [makeManagedProfileRow()] });
      renderWithProviders(<FamilyPage />, { route: '/family' });

      expect(await screen.findByText(/^Amma, \d+$/)).toBeInTheDocument();
      expect(screen.getByText('Managed by you')).toBeInTheDocument();
    });

    it('labels a child as one', async () => {
      stubFamily({ managed: [makeManagedProfileRow({ full_name: 'Kiran', is_minor: true })] });
      renderWithProviders(<FamilyPage />, { route: '/family' });

      expect(await screen.findByText('Child')).toBeInTheDocument();
    });

    it('does not label an adult as a child', async () => {
      stubFamily({ managed: [makeManagedProfileRow()] });
      renderWithProviders(<FamilyPage />, { route: '/family' });

      await screen.findByText('Managed by you');
      expect(screen.queryByText('Child')).not.toBeInTheDocument();
    });

    it('switches into their records when their card is chosen', async () => {
      stubFamily({ managed: [makeManagedProfileRow()] });
      const user = userEvent.setup();
      renderWithProviders(
        <>
          <ViewingAsBanner />
          <FamilyPage />
        </>,
        { route: '/family' },
      );

      await user.click(await screen.findByRole('button', { name: /Amma, \d+/ }));

      expect(await screen.findByText(/You're in Amma's records/)).toBeInTheDocument();
    });

    it('stops offering to add more once the cap is reached', async () => {
      const managed = Array.from({ length: MAX_MANAGED_PROFILES }, (_, index) =>
        makeManagedProfileRow({
          id: `00000000-0000-4000-8000-00000000ab0${index}`,
          full_name: `Person ${index}`,
        }),
      );
      stubFamily({ managed });
      renderWithProviders(<FamilyPage />, { route: '/family' });

      // Wait for the profiles themselves — the button renders before they load.
      expect(await screen.findAllByText('Managed by you')).toHaveLength(MAX_MANAGED_PROFILES);
      expect(screen.getByRole('button', { name: /Add a profile/ })).toBeDisabled();
    });

    it('says how many more can be added while there is room', async () => {
      stubFamily({ managed: [makeManagedProfileRow()] });
      renderWithProviders(<FamilyPage />, { route: '/family' });

      expect(
        await screen.findByText(`You can add ${MAX_MANAGED_PROFILES - 1} more.`),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add a profile/ })).toBeEnabled();
    });

    it('surfaces a handover waiting on me, naming who asked', async () => {
      const managed = makeManagedProfileRow();
      stubFamily({
        managed: [managed],
        claims: [
          {
            id: '00000000-0000-4000-8000-0000000000c1',
            profile_id: managed.id,
            profile_name: 'Amma',
            status: 'awaiting_manager',
            invitee_email: null,
            claimant_name: 'Meera',
            claimed_at: '2026-08-07T10:00:00.000Z',
            expires_at: '2026-08-10T10:00:00.000Z',
            created_at: '2026-08-07T09:00:00.000Z',
          },
        ],
      });
      renderWithProviders(<FamilyPage />, { route: '/family' });

      expect(await screen.findByText(/Meera has asked to take over Amma/)).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'Review' })).toBeInTheDocument();
    });

    it('says nothing about handovers when none is waiting', async () => {
      stubFamily({ managed: [makeManagedProfileRow()] });
      renderWithProviders(<FamilyPage />, { route: '/family' });

      await screen.findByText('Managed by you');
      expect(screen.queryByText(/wants to take over/)).not.toBeInTheDocument();
    });
  });
});
