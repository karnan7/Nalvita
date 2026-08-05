import type { CirclePerson } from '@nalvita/core';
import { createContext, useContext } from 'react';

/**
 * Whose records the app is currently showing.
 *
 * Every data hook reads `userId` from here rather than from the session, so
 * "viewing as" is a single switch rather than a parameter threaded through the
 * app — and so a caregiver's own records and the person's they are helping can
 * never be read or written interchangeably.
 */
export interface ActiveProfileState {
  /** The account being shown: my own id unless I am viewing a family member. */
  userId: string;
  /** True when these are my own records. */
  isSelf: boolean;
  /** The membership I am viewing through, or null for my own account. */
  viewing: CirclePerson | null;
  /** Switch to a family member's records, or back to my own with null. */
  setViewing: (person: CirclePerson | null) => void;
  /**
   * Runs `write` once the person has acknowledged whose account they are
   * writing into. In my own account it runs immediately; in someone else's it
   * runs after the first confirmation and immediately thereafter.
   */
  guardWrite: (write: () => void) => void;
}

const NOT_READY: ActiveProfileState = {
  userId: '',
  isSelf: true,
  viewing: null,
  setViewing: () => undefined,
  guardWrite: (write) => write(),
};

export const ActiveProfileContext = createContext<ActiveProfileState>(NOT_READY);

export function useActiveProfile(): ActiveProfileState {
  return useContext(ActiveProfileContext);
}
