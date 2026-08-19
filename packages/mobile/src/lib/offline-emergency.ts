import type { Allergy, Medicine } from '@nalvita/core';
import { useActiveProfile, useAllergies, useAuth, useMedicines, useProfile } from '@nalvita/data';
import { useEffect, useState } from 'react';

import {
  readEmergencySnapshot,
  saveEmergencySnapshot,
  type EmergencySnapshot,
} from '@/lib/offline-cache';

/**
 * Keeping the offline set in step with the server, and reading it back.
 *
 * The write side runs whenever fresh data arrives; the read side is what the
 * screens fall back to when there is no network. Nothing here decides *what* is
 * cached — that is `offline-cache.ts`, so the policy lives in one place.
 */

/**
 * Mirrors the emergency set into the encrypted cache as data arrives.
 *
 * Mounted once, near the root. It writes only when React Query has genuinely
 * resolved all three queries: offline, `data` is undefined and this does
 * nothing, so a failed fetch can never blank out a good snapshot.
 */
export function useEmergencyCacheSync(): void {
  const { profileId } = useActiveProfile();
  const { session } = useAuth();
  const { data: profile } = useProfile(session?.user.id);
  const { data: allergies } = useAllergies();
  const { data: medicines } = useMedicines();

  useEffect(() => {
    if (!profileId || !profile || !allergies || !medicines) return;

    void saveEmergencySnapshot({
      profileId,
      profile: {
        full_name: profile.full_name,
        date_of_birth: profile.date_of_birth,
        gender: profile.gender,
        blood_group: profile.blood_group,
      },
      allergies,
      medicines,
    });
  }, [profileId, profile, allergies, medicines]);
}

/**
 * The cached emergency set, or null when there is none for this profile.
 *
 * Screens use it as a fallback rather than a source: live data always wins, so
 * a stale allergy list can never mask a corrected one.
 */
export function useEmergencySnapshot(): EmergencySnapshot | null {
  const { profileId } = useActiveProfile();
  const [snapshot, setSnapshot] = useState<EmergencySnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!profileId) {
      setSnapshot(null);
      return;
    }

    void readEmergencySnapshot(profileId).then((found) => {
      if (!cancelled) setSnapshot(found);
    });

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  return snapshot;
}

export interface EmergencyFallback {
  allergies: Allergy[];
  medicines: Medicine[];
  /** True when the allergies above came from the cache rather than the server. */
  allergiesFromCache: boolean;
  /** True when the medicines above came from the cache rather than the server. */
  medicinesFromCache: boolean;
}

/**
 * What a screen should show for the emergency set right now.
 *
 * Each field falls back independently, and reports independently. A single
 * combined "from cache" flag was the obvious first shape and the wrong one: a
 * screen that shows only allergies would have reported stale data whenever a
 * cached *medicines* list happened to exist, telling people their allergy list
 * was out of date while they were online and it was not.
 *
 * Live data always wins where it exists — a stale allergy list must never mask
 * a corrected one — and the per-field flags are what let a screen say so out
 * loud, which showing possibly-stale health information demands.
 */
export function useEmergencyFallback(live: {
  allergies?: Allergy[];
  medicines?: Medicine[];
}): EmergencyFallback {
  const snapshot = useEmergencySnapshot();

  return {
    allergies: live.allergies ?? snapshot?.allergies ?? [],
    medicines: live.medicines ?? snapshot?.medicines ?? [],
    allergiesFromCache: live.allergies === undefined && snapshot !== null,
    medicinesFromCache: live.medicines === undefined && snapshot !== null,
  };
}
