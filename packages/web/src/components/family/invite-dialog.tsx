import { CIRCLE_ROLES, type CircleRole, type ShareCategory } from '@nalvita/core';
import { Check, Copy } from 'lucide-react';
import { useEffect, useState, type SyntheticEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { useAuth } from '@/lib/auth-context';
import {
  CIRCLE_ROLE_DESCRIPTIONS,
  CIRCLE_ROLE_LABELS,
  SHAREABLE_CATEGORIES,
  SHARE_CATEGORY_LABELS,
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

/** A read-only field with a copy button, for the generated code and link. */
function CopyField({ label, value }: Readonly<{ label: string; value: string }>) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-content">{label}</span>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg bg-sunken px-3 py-2 text-sm text-content">
          {value}
        </code>
        <Button type="button" variant="outline" size="icon" onClick={() => void copy()} aria-label={`Copy ${label}`}>
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
    </div>
  );
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

  const shareAll = form.categories.includes('all');

  function setRole(role: CircleRole) {
    setForm((prev) => ({ ...prev, role }));
  }

  function toggleAll() {
    setForm((prev) => ({ ...prev, categories: shareAll ? [] : ['all'] }));
  }

  function toggleCategory(category: ShareCategory) {
    setForm((prev) => {
      const withoutAll: ShareCategory[] = prev.categories.filter((c) => c !== 'all');
      const next = withoutAll.includes(category)
        ? withoutAll.filter((c) => c !== category)
        : [...withoutAll, category];
      return { ...prev, categories: next };
    });
  }

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (form.categories.length === 0) return;
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-role">What they can do</Label>
            <Select
              id="invite-role"
              value={form.role}
              onChange={(event) => setRole(event.target.value as CircleRole)}
            >
              {CIRCLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {CIRCLE_ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
            <p className="text-sm text-content-muted">{CIRCLE_ROLE_DESCRIPTIONS[form.role]}</p>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-content">What to share</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" checked={shareAll} onChange={toggleAll} />
              {SHARE_CATEGORY_LABELS.all}
            </label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {SHAREABLE_CATEGORIES.map((category) => (
                <label key={category} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    disabled={shareAll}
                    checked={shareAll || form.categories.includes(category)}
                    onChange={() => toggleCategory(category)}
                  />
                  {SHARE_CATEGORY_LABELS[category]}
                </label>
              ))}
            </div>
          </fieldset>

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
            <Button type="submit" disabled={create.isPending || form.categories.length === 0}>
              {create.isPending ? 'Creating…' : 'Create invite'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
