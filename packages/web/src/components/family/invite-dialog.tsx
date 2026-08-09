import { useEffect, useState, type SyntheticEvent } from 'react';

import { AccessFields } from '@/components/family/access-fields';
import { CopyField } from '@/components/family/copy-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { useAuth } from '@/lib/auth-context';
import {
  isValidSelection,
  useCreateInvite,
  type CreatedInvite,
  type InviteFormValues,
} from '@/lib/circle';

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
}

function emptyForm(): InviteFormValues {
  return { role: 'viewer', categories: ['all'], invitee_email: '' };
}

function CreatedInviteView({
  invite,
  onDone,
}: Readonly<{ invite: CreatedInvite; onDone: () => void }>) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-content-secondary">
        Share either of these with your family member. They&apos;re valid for 24 hours and can be
        used once.
      </p>
      <CopyField label="6-digit code" value={invite.code} />
      <CopyField label="Invite link" value={invite.link} />
      <div className="flex justify-end">
        <Button type="button" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

export function InviteDialog({ open, onClose }: Readonly<InviteDialogProps>) {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const create = useCreateInvite(userId);
  const [form, setForm] = useState<InviteFormValues>(emptyForm);
  const [created, setCreated] = useState<CreatedInvite | null>(null);

  useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setCreated(null);
    }
  }, [open]);

  function handleClose() {
    create.reset();
    onClose();
  }

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (!isValidSelection(form)) return;
    create.mutate(form, { onSuccess: setCreated });
  }

  const submitError = create.isError
    ? "We couldn't create this invite. Please try again."
    : null;

  return (
    <Modal open={open} onClose={handleClose} title="Invite a family member">
      {created ? (
        <CreatedInviteView invite={created} onDone={handleClose} />
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-5">
          <AccessFields
            idPrefix="invite"
            value={form}
            onChange={(next) => setForm((prev) => ({ ...prev, ...next }))}
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-email">Their email (optional)</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="so you can tell invites apart"
              value={form.invitee_email}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, invitee_email: event.target.value }))
              }
            />
          </div>

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || !isValidSelection(form)}>
              {create.isPending ? 'Creating…' : 'Create invite'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
