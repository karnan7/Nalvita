import { ALLERGY_SEVERITIES, type Allergy, type AllergySeverity } from '@nalvita/core';
import { useEffect, useState, type SyntheticEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth-context';
import {
  ALLERGY_SEVERITY_LABELS,
  useAddAllergy,
  useUpdateAllergy,
  type AllergyFormValues,
} from '@/lib/allergies';

interface AllergyDialogProps {
  open: boolean;
  onClose: () => void;
  /** When set, the form edits this allergy instead of adding a new one. */
  allergy?: Allergy | null;
}

function emptyForm(): AllergyFormValues {
  return { allergen: '', severity: 'mild', reaction: null };
}

function formFromAllergy(allergy: Allergy): AllergyFormValues {
  return { allergen: allergy.allergen, severity: allergy.severity, reaction: allergy.reaction };
}

export function AllergyDialog({ open, onClose, allergy }: Readonly<AllergyDialogProps>) {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const add = useAddAllergy(userId);
  const update = useUpdateAllergy();
  const isEditing = Boolean(allergy);
  const mutation = isEditing ? update : add;

  const [form, setForm] = useState<AllergyFormValues>(emptyForm);

  useEffect(() => {
    if (open) setForm(allergy ? formFromAllergy(allergy) : emptyForm());
  }, [open, allergy]);

  function set<K extends keyof AllergyFormValues>(key: K, value: AllergyFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function close() {
    mutation.reset();
    onClose();
  }

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (isEditing && allergy) {
      update.mutate({ id: allergy.id, values: form }, { onSuccess: close });
    } else {
      add.mutate(form, { onSuccess: close });
    }
  }

  const submitError = mutation.isError ? "We couldn't save this allergy. Please try again." : null;

  return (
    <Modal open={open} onClose={close} title={isEditing ? 'Edit allergy' : 'Add allergy'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="allergy-name">Allergen</Label>
          <Input
            id="allergy-name"
            required
            placeholder="e.g. Penicillin"
            value={form.allergen}
            onChange={(event) => set('allergen', event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="allergy-severity">Severity</Label>
          <Select
            id="allergy-severity"
            required
            value={form.severity}
            onChange={(event) => set('severity', event.target.value as AllergySeverity)}
          >
            {ALLERGY_SEVERITIES.map((value) => (
              <option key={value} value={value}>
                {ALLERGY_SEVERITY_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="allergy-reaction">Reaction (optional)</Label>
          <Textarea
            id="allergy-reaction"
            placeholder="e.g. Rash and swelling"
            value={form.reaction ?? ''}
            onChange={(event) => set('reaction', event.target.value || null)}
          />
        </div>

        {submitError && <p className="text-sm text-destructive">{submitError}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save allergy'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
