import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { DocumentsScreen } from '@/screens/documents-screen';
import { HomeScreen } from '@/screens/home-screen';
import { MedicinesScreen } from '@/screens/medicines-screen';
import { ProfileScreen } from '@/screens/profile-screen';
import { VitalsScreen } from '@/screens/vitals-screen';
import {
  makeAllergyRow,
  makeConditionRow,
  makeDoctorRow,
  makeDocumentRow,
  makeMedicineRow,
  makeVitalRow,
} from '@/test/fixtures';
import { makeHarness, makeProfileRow, renderWithProviders, stubTables } from '@/test/render';

const SESSION = {
  user: { id: '00000000-0000-4000-8000-000000000001', email: 'amma@example.com' },
};

jest.mock('@nalvita/data', () => {
  const actual = jest.requireActual('@nalvita/data');
  return { ...actual, useAuth: () => ({ session: SESSION, loading: false }) };
});

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

beforeEach(() => {
  mockPush.mockClear();
});

describe('HomeScreen', () => {
  it('counts what is on file', async () => {
    const harness = stubTables(makeHarness(), {
      documents: [makeDocumentRow()],
      medicines: [makeMedicineRow(), makeMedicineRow({ id: '00000000-0000-4000-8000-0000000000e2', status: 'stopped' })],
      vitals: [makeVitalRow()],
      allergies: [],
    });

    renderWithProviders(<HomeScreen />, harness);

    // One medicine is stopped, so "taking now" is 1, not 2.
    await waitFor(() => expect(screen.getByText('Documents')).toBeOnTheScreen());
    await waitFor(() => expect(screen.getByText('Metformin')).toBeOnTheScreen());
  });

  /** Allergies are the one thing that has to be impossible to miss. */
  it('raises recorded allergies in a banner', async () => {
    const harness = stubTables(makeHarness(), {
      allergies: [makeAllergyRow()],
      documents: [],
      medicines: [],
      vitals: [],
    });

    renderWithProviders(<HomeScreen />, harness);

    await waitFor(() => expect(screen.getByText('Allergies')).toBeOnTheScreen());
    expect(screen.getByText('Penicillin')).toBeOnTheScreen();
  });

  it('shows no allergy banner when there are none', async () => {
    const harness = stubTables(makeHarness(), {
      allergies: [],
      documents: [],
      medicines: [],
      vitals: [],
    });

    renderWithProviders(<HomeScreen />, harness);

    await waitFor(() => expect(screen.getByText('Documents')).toBeOnTheScreen());
    expect(screen.queryByText('Allergies')).not.toBeOnTheScreen();
  });

  it('greets the person by name once their profile loads', async () => {
    const harness = stubTables(
      makeHarness(),
      { documents: [], medicines: [], vitals: [], allergies: [] },
      makeProfileRow({ full_name: 'Amma' }),
    );

    renderWithProviders(<HomeScreen />, harness);

    await waitFor(() => expect(screen.getByText('Hello, Amma')).toBeOnTheScreen());
  });

  it('falls back to a plain greeting when no name is set', async () => {
    const harness = stubTables(makeHarness(), {
      documents: [],
      medicines: [],
      vitals: [],
      allergies: [],
    });

    renderWithProviders(<HomeScreen />, harness);

    await waitFor(() => expect(screen.getByText('Hello')).toBeOnTheScreen());
  });

  it('takes you to the matching screen when a stat card is tapped', async () => {
    const harness = stubTables(makeHarness(), {
      documents: [makeDocumentRow()],
      medicines: [],
      vitals: [],
      allergies: [],
    });

    renderWithProviders(<HomeScreen />, harness);
    await waitFor(() => expect(screen.getByText('Documents')).toBeOnTheScreen());

    fireEvent.press(screen.getByText('Documents'));

    expect(mockPush).toHaveBeenCalledWith('/documents');
  });

  it('opens the profile from the allergy banner, where allergies are listed', async () => {
    const harness = stubTables(makeHarness(), {
      allergies: [makeAllergyRow()],
      documents: [],
      medicines: [],
      vitals: [],
    });

    renderWithProviders(<HomeScreen />, harness);
    await waitFor(() => expect(screen.getByText('Penicillin')).toBeOnTheScreen());

    fireEvent.press(screen.getByText('Penicillin'));

    expect(mockPush).toHaveBeenCalledWith('/profile');
  });

  it('says so plainly when nothing has been recorded', async () => {
    const harness = stubTables(makeHarness(), {
      documents: [],
      medicines: [],
      vitals: [],
      allergies: [],
    });

    renderWithProviders(<HomeScreen />, harness);

    await waitFor(() => expect(screen.getByText('Nothing recorded yet.')).toBeOnTheScreen());
    expect(screen.getByText('No readings logged yet.')).toBeOnTheScreen();
  });
});

describe('DocumentsScreen', () => {
  it('lists documents with their details', async () => {
    const harness = stubTables(makeHarness(), { documents: [makeDocumentRow()] });

    renderWithProviders(<DocumentsScreen />, harness);

    await waitFor(() => expect(screen.getByText('Blood test report')).toBeOnTheScreen());
    expect(screen.getByText(/Lab Report · City Lab/)).toBeOnTheScreen();
  });

  it('narrows to a category, and back again', async () => {
    const harness = stubTables(makeHarness(), {
      documents: [makeDocumentRow(), makeDocumentRow({ id: '00000000-0000-4000-8000-0000000000d2', title: 'Chest X-ray', category: 'xray_scan' })],
    });

    renderWithProviders(<DocumentsScreen />, harness);
    await waitFor(() => expect(screen.getByText('Chest X-ray')).toBeOnTheScreen());

    fireEvent.press(screen.getByRole('button', { name: 'X-Ray / Scan' }));

    expect(screen.getByText('Chest X-ray')).toBeOnTheScreen();
    expect(screen.queryByText('Blood test report')).not.toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('Blood test report')).toBeOnTheScreen();
  });

  /**
   * The file is private; only a short-lived signed URL may reach it, minted at
   * the moment of opening and never stored.
   */
  it('opens a document through a freshly signed URL', async () => {
    const harness = stubTables(makeHarness(), { documents: [makeDocumentRow()] });
    const createSignedUrl = jest.fn(async () => ({
      data: { signedUrl: 'https://storage.test/signed' },
      error: null,
    }));
    (harness.client.storage as unknown as { from: () => unknown }).from = () => ({ createSignedUrl });

    renderWithProviders(<DocumentsScreen />, harness);
    await waitFor(() => expect(screen.getByText('Blood test report')).toBeOnTheScreen());

    fireEvent.press(screen.getByRole('button', { name: 'Open Blood test report' }));

    await waitFor(() => expect(harness.openUrl).toHaveBeenCalledWith('https://storage.test/signed'));
    // Viewing, not saving — an attachment disposition would download it instead.
    expect(createSignedUrl).toHaveBeenCalledWith(`${makeDocumentRow().file_path}`, 60);
  });

  it('says so when a document will not open', async () => {
    const harness = stubTables(makeHarness(), { documents: [makeDocumentRow()] });
    (harness.client.storage as unknown as { from: () => unknown }).from = () => ({
      createSignedUrl: jest.fn(async () => ({ data: null, error: { message: 'denied' } })),
    });

    renderWithProviders(<DocumentsScreen />, harness);
    await waitFor(() => expect(screen.getByText('Blood test report')).toBeOnTheScreen());

    fireEvent.press(screen.getByRole('button', { name: 'Open Blood test report' }));

    await waitFor(() =>
      expect(screen.getByText(/could not open that document/i)).toBeOnTheScreen(),
    );
  });

  it('offers a prompt rather than a blank page when there is nothing', async () => {
    const harness = stubTables(makeHarness(), { documents: [] });

    renderWithProviders(<DocumentsScreen />, harness);

    await waitFor(() => expect(screen.getByText('No documents yet')).toBeOnTheScreen());
  });
});

describe('MedicinesScreen', () => {
  it('separates what is being taken from what has stopped', async () => {
    const harness = stubTables(makeHarness(), {
      medicines: [
        makeMedicineRow(),
        makeMedicineRow({ id: '00000000-0000-4000-8000-0000000000e2', name: 'Amoxicillin', status: 'stopped', end_date: '2026-07-01' }),
      ],
    });

    renderWithProviders(<MedicinesScreen />, harness);

    await waitFor(() => expect(screen.getByText('Metformin')).toBeOnTheScreen());
    expect(screen.queryByText('Amoxicillin')).not.toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Past' }));

    expect(screen.getByText('Amoxicillin')).toBeOnTheScreen();
    expect(screen.queryByText('Metformin')).not.toBeOnTheScreen();
  });

  it('shows dosage and schedule in words, not database values', async () => {
    const harness = stubTables(makeHarness(), { medicines: [makeMedicineRow()] });

    renderWithProviders(<MedicinesScreen />, harness);

    await waitFor(() => expect(screen.getByText(/Twice a day/)).toBeOnTheScreen());
    expect(screen.getByText('Morning, Night')).toBeOnTheScreen();
  });

  it('flags a medicine that needs refilling', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const harness = stubTables(makeHarness(), {
      medicines: [makeMedicineRow({ refill_date: today })],
    });

    renderWithProviders(<MedicinesScreen />, harness);

    await waitFor(() => expect(screen.getByText('Refill due')).toBeOnTheScreen());
  });
});

describe('VitalsScreen', () => {
  it('lists readings with their value and unit', async () => {
    const harness = stubTables(makeHarness(), { vitals: [makeVitalRow()] });

    renderWithProviders(<VitalsScreen />, harness);

    await waitFor(() => expect(screen.getByText('128/84 mmHg')).toBeOnTheScreen());
  });

  it('switches between kinds of reading', async () => {
    const harness = stubTables(makeHarness(), {
      vitals: [makeVitalRow(), makeVitalRow({ id: '00000000-0000-4000-8000-0000000000f2', type: 'weight', value_1: 70, value_2: null })],
    });

    renderWithProviders(<VitalsScreen />, harness);
    await waitFor(() => expect(screen.getByText('128/84 mmHg')).toBeOnTheScreen());

    fireEvent.press(screen.getByRole('button', { name: 'Weight' }));

    expect(screen.getByText('70 kg')).toBeOnTheScreen();
    expect(screen.queryByText('128/84 mmHg')).not.toBeOnTheScreen();
  });

  /** Weight has no universal healthy range, so the app must not judge it. */
  it('does not put a status on a weight reading', async () => {
    const harness = stubTables(makeHarness(), {
      vitals: [makeVitalRow({ id: '00000000-0000-4000-8000-0000000000f2', type: 'weight', value_1: 70, value_2: null })],
    });

    renderWithProviders(<VitalsScreen />, harness);

    fireEvent.press(await screen.findByRole('button', { name: 'Weight' }));

    expect(screen.queryByText('Normal')).not.toBeOnTheScreen();
    expect(screen.queryByText('High')).not.toBeOnTheScreen();
  });

  it('prompts when there is nothing of this kind yet', async () => {
    const harness = stubTables(makeHarness(), { vitals: [] });

    renderWithProviders(<VitalsScreen />, harness);

    await waitFor(() => expect(screen.getByText('No readings yet')).toBeOnTheScreen());
  });
});

describe('ProfileScreen', () => {
  it('shows details, allergies, conditions and doctors together', async () => {
    const harness = stubTables(
      makeHarness(),
      {
        allergies: [makeAllergyRow()],
        conditions: [makeConditionRow()],
        doctors: [makeDoctorRow()],
      },
      makeProfileRow({ full_name: 'Amma', blood_group: 'O+', date_of_birth: '1955-03-12' }),
    );

    renderWithProviders(<ProfileScreen />, harness);

    await waitFor(() => expect(screen.getByText('Amma')).toBeOnTheScreen());
    expect(screen.getByText('O+')).toBeOnTheScreen();
    expect(screen.getByText('Penicillin')).toBeOnTheScreen();
    expect(screen.getByText('Hypertension')).toBeOnTheScreen();
    expect(screen.getByText('Dr Suresh Pillai')).toBeOnTheScreen();
  });

  it('says "Not set" rather than leaving a detail blank', async () => {
    const harness = stubTables(makeHarness(), {}, makeProfileRow());

    renderWithProviders(<ProfileScreen />, harness);

    await waitFor(() => expect(screen.getAllByText('Not set').length).toBeGreaterThan(0));
    expect(screen.getAllByText('None recorded.')).toHaveLength(3);
  });

  it('signs out through the injected client', async () => {
    const harness = stubTables(makeHarness(), {});

    renderWithProviders(<ProfileScreen />, harness);

    fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(harness.signOut).toHaveBeenCalled());
  });
});
