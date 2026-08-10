import type { CirclePerson } from '@nalvita/core';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { ActiveProfileContext, useAuth, useProfile } from '@nalvita/data';

/** How a family member is referred to when they have not set a name. */
export function viewingName(person: CirclePerson | null): string {
  return person?.counterpart_name?.trim() || 'this family member';
}

/**
 * Tracks whose records the app is showing and exposes it via
 * ActiveProfileContext.
 *
 * Deliberately in memory only: which relative you were looking at is health
 * context, so it is never persisted, and a reload puts you back in your own
 * account — the safe default.
 */
export function ActiveProfileProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { session } = useAuth();
  // Records belong to profiles, so the app needs my *profile* id, which only
  // my profile row can give: the session knows my account, not my identity here.
  const { data: myProfile } = useProfile(session?.user.id);
  const selfId = myProfile?.id ?? '';

  const [viewing, setViewing] = useState<CirclePerson | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  // Held as a thunk: setState would otherwise call the function it is given.
  const [pendingWrite, setPendingWrite] = useState<(() => void) | null>(null);

  // Signing out — or signing in as someone else — must never leave another
  // person's records on screen.
  useEffect(() => {
    setViewing(null);
  }, [selfId]);

  const switchTo = useCallback((person: CirclePerson | null) => {
    setViewing(person);
    // Each switch earns its own acknowledgement.
    setConfirmed(false);
  }, []);

  const guardWrite = useCallback(
    (write: () => void) => {
      if (viewing === null || confirmed) {
        write();
        return;
      }
      setPendingWrite(() => write);
    },
    [viewing, confirmed],
  );

  function closeConfirm() {
    setPendingWrite(null);
  }

  function acceptConfirm() {
    setPendingWrite(null);
    setConfirmed(true);
    pendingWrite?.();
  }

  const value = useMemo(
    () => ({
      profileId: viewing?.counterpart_id ?? selfId,
      isSelf: viewing === null,
      viewing,
      setViewing: switchTo,
      guardWrite,
    }),
    [viewing, selfId, switchTo, guardWrite],
  );

  return (
    <ActiveProfileContext.Provider value={value}>
      {children}
      <Modal
        open={pendingWrite !== null}
        onClose={closeConfirm}
        title="This is not your account"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-content-secondary">
            You are about to add or change something in {viewingName(viewing)}&apos;s records, not
            your own. They will see it in their activity feed.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeConfirm}>
              Cancel
            </Button>
            <Button type="button" onClick={acceptConfirm}>
              Yes, continue
            </Button>
          </div>
        </div>
      </Modal>
    </ActiveProfileContext.Provider>
  );
}
