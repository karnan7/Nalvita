import type { CirclePerson } from '@nalvita/core';
import { createContext, useContext } from 'react';

/**
 * Whose records the app is currently showing.
 *
 * Every data hook reads `profileId` from here rather than from the session, so
 * "viewing as" is a single switch rather than a parameter threaded through the
 * app — and so a caregiver's own records and the records of the person they are
 * helping can never be read or written interchangeably.
 *
 * It is a *profile* id, not an account id: the person on screen may have no
 * account at all.
 */
export interface ActiveProfileState {
  /** The profile being shown: my own unless I am viewing a family member. */
  profileId: string;
  /** True when this is my own profile. */
  isSelf: boolean;
  /** The membership I am viewing through, or null for my own profile. */
  viewing: CirclePerson | null;
  /** Switch to a family member's records, or back to my own with null. */
  setViewing: (person: CirclePerson | null) => void;
  /**
   * Runs `write` once the person has acknowledged whose records they are
   * writing into. In my own profile it runs immediately; in someone else's it
   * runs after the first confirmation and immediately thereafter.
   */
  guardWrite: (write: () => void) => void;
}

const NOT_READY: ActiveProfileState = {
  profileId: '',
  isSelf: true,
  viewing: null,
  setViewing: () => undefined,
  guardWrite: (write) => write(),
};

export const ActiveProfileContext = createContext<ActiveProfileState>(NOT_READY);

export function useActiveProfile(): ActiveProfileState {
  return useContext(ActiveProfileContext);
}
