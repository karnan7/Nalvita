import type { CirclePerson } from '@nalvita/core';
import { useEffect, useState, type SyntheticEvent } from 'react';

import { AccessFields } from '@/components/family/access-fields';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { isValidSelection, useUpdateMembership, type AccessSelection } from '@/lib/circle';

interface ManageAccessDialogProps {
  person: CirclePerson | null;
  onClose: () => void;
}

function selectionFor(person: CirclePerson | null): AccessSelection {
  return {
    role: person?.role ?? 'viewer',
    categories: person ? [...person.shared_categories] : ['all'],
  };
}

/**
 * Change what one person in my circle can do and see. Changes apply
 * immediately — including downgrades, which need no re-consent because they
 * only ever take access away.
 */
export function ManageAccessDialog({ person, onClose }: Readonly<ManageAccessDialogProps>) {
  const update = useUpdateMembership();
  const [selection, setSelection] = useState<AccessSelection>(() => selectionFor(person));

  useEffect(() => {
    if (person) setSelection(selectionFor(person));
  }, [person]);

  function handleClose() {
    update.reset();
    onClose();
  }

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (!person || !isValidSelection(selection)) return;
    update.mutate(
      {
        membershipId: person.membership_id,
        role: selection.role,
        categories: selection.categories,
      },
      { onSuccess: onClose },
    );
  }

  const name = person?.counterpart_name?.trim() || 'this family member';

  return (
    <Modal open={person !== null} onClose={handleClose} title="Change what they can see">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <p className="text-sm text-content-secondary">
          Changes to {name}&apos;s access take effect straight away.
        </p>

        <AccessFields idPrefix="manage" value={selection} onChange={setSelection} />

        {update.isError && (
          <p className="text-sm text-destructive">
            We couldn&apos;t save this change. Please try again.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={update.isPending || !isValidSelection(selection)}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
