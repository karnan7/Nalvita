import { allergySchema, medicineSchema } from '@nalvita/core';
import { screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  clearOfflineCache,
  readEmergencySnapshot,
  resetOfflineCacheForTests,
  saveEmergencySnapshot,
} from '@/lib/offline-cache';
import { useEmergencyCacheSync, useEmergencyFallback } from '@/lib/offline-emergency';
import { makeAllergyRow, makeMedicineRow } from '@/test/fixtures';
import { chain, makeHarness, PROFILE_ID, renderWithProviders, stubTables } from '@/test/render';

function allergy(overrides: Record<string, unknown> = {}) {
  return allergySchema.parse(makeAllergyRow(overrides));
}

function medicine(overrides: Record<string, unknown> = {}) {
  return medicineSchema.parse(makeMedicineRow(overrides));
}

function Sync() {
  useEmergencyCacheSync();
  return null;
}

/** Renders the fallback's answer so a test can read it back. */
function Fallback({
  allergies,
  medicines,
}: Readonly<{ allergies?: ReturnType<typeof allergy>[]; medicines?: ReturnType<typeof medicine>[] }>) {
  const result = useEmergencyFallback({ allergies, medicines });
  return (
    <Text>
      {`allergens:${result.allergies.map((a) => a.allergen).join(',')} ` +
        `medicines:${result.medicines.map((m) => m.name).join(',')} ` +
        `allergiesFromCache:${result.allergiesFromCache} ` +
        `medicinesFromCache:${result.medicinesFromCache}`}
    </Text>
  );
}

function readout() {
  return screen.getByText(/allergens:/).props.children as string;
}

beforeEach(async () => {
  await clearOfflineCache();
  resetOfflineCacheForTests();
});

describe('keeping the cache in step', () => {
  it('writes the emergency set once the queries resolve', async () => {
    const harness = stubTables(makeHarness({ signedIn: true }), {
      allergies: [makeAllergyRow()],
      medicines: [makeMedicineRow()],
    });

    renderWithProviders(<Sync />, harness);

    await waitFor(async () => {
      const snapshot = await readEmergencySnapshot(PROFILE_ID);
      expect(snapshot?.allergies[0]?.allergen).toBe('Penicillin');
    });
  });

  /**
   * Offline, React Query resolves nothing and `data` stays undefined. A write
   * here would replace a good snapshot with an empty one — exactly when the
   * cache is the only thing left.
   */
  it('does not blank a good snapshot when the queries return nothing', async () => {
    await saveEmergencySnapshot({
      profileId: PROFILE_ID,
      profile: {
        full_name: 'Test Person',
        date_of_birth: '1950-01-01',
        gender: 'female',
        blood_group: 'O+',
      },
      allergies: [allergy()],
      medicines: [medicine()],
    });

    const harness = makeHarness({ signedIn: true });
    // Every query fails, the way it does with no network. React Query leaves
    // `data` undefined, which is the condition the sync must not write on.
    harness.from.mockImplementation(() =>
      chain({ data: null, error: { message: 'network request failed' } }),
    );

    renderWithProviders(<Sync />, harness);

    // Let the failures settle before checking the cache survived them.
    await waitFor(() => {
      expect(harness.from).toHaveBeenCalled();
    });

    await expect(readEmergencySnapshot(PROFILE_ID)).resolves.not.toBeNull();
  });
});

describe('what a screen shows', () => {
  it('prefers live data, so a corrected allergy is never masked by a stale one', async () => {
    await saveEmergencySnapshot({
      profileId: PROFILE_ID,
      profile: {
        full_name: 'Test Person',
        date_of_birth: '1950-01-01',
        gender: 'female',
        blood_group: 'O+',
      },
      allergies: [allergy({ allergen: 'Stale entry' })],
      medicines: [],
    });

    renderWithProviders(<Fallback allergies={[allergy({ allergen: 'Corrected' })]} />);

    await waitFor(() => {
      expect(readout()).toContain('allergens:Corrected');
    });
    expect(readout()).toContain('allergiesFromCache:false');
  });

  it('falls back to the cache when there is no live answer, and says so', async () => {
    await saveEmergencySnapshot({
      profileId: PROFILE_ID,
      profile: {
        full_name: 'Test Person',
        date_of_birth: '1950-01-01',
        gender: 'female',
        blood_group: 'O+',
      },
      allergies: [allergy()],
      medicines: [medicine()],
    });

    renderWithProviders(<Fallback />);

    await waitFor(() => {
      expect(readout()).toContain('allergens:Penicillin');
    });
    expect(readout()).toContain('medicines:Metformin');
    expect(readout()).toContain('allergiesFromCache:true');
    expect(readout()).toContain('medicinesFromCache:true');
  });

  /**
   * The Profile screen shows allergies and not medicines. A single combined
   * "from cache" flag made it announce stale allergies whenever a cached
   * medicines list existed — while online, with a perfectly fresh allergy
   * list. The flags have to be per-field.
   */
  it('reports each field on its own, so one cached field does not taint another', async () => {
    await saveEmergencySnapshot({
      profileId: PROFILE_ID,
      profile: {
        full_name: 'Test Person',
        date_of_birth: '1950-01-01',
        gender: 'female',
        blood_group: 'O+',
      },
      allergies: [allergy({ allergen: 'Stale entry' })],
      medicines: [medicine()],
    });

    renderWithProviders(<Fallback allergies={[allergy({ allergen: 'Live' })]} />);

    await waitFor(() => {
      expect(readout()).toContain('allergens:Live');
    });
    // Allergies are live and must not be announced as stale...
    expect(readout()).toContain('allergiesFromCache:false');
    // ...even though medicines genuinely did come from the cache.
    expect(readout()).toContain('medicinesFromCache:true');
  });

  it('shows nothing rather than guessing when there is no cache either', async () => {
    renderWithProviders(<Fallback />);

    await waitFor(() => {
      expect(readout()).toContain('allergens: ');
    });
    expect(readout()).toContain('allergiesFromCache:false');
  });
});
