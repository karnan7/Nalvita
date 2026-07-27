import { CONDITION_STATUSES, type Condition, type ConditionStatus } from '@nalvita/core';
import { useEffect, useState, type SyntheticEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth-context';
import {
  CONDITION_STATUS_LABELS,
  useAddCondition,
  useUpdateCondition,
  type ConditionFormValues,
} from '@/lib/conditions';

interface ConditionDialogProps {
  open: boolean;
  onClose: () => void;
  /** When set, the form edits this condition instead of adding a new one. */
  condition?: Condition | null;
}

function emptyForm(): ConditionFormValues {
  return { name: '', diagnosis_date: null, doctor_name: null, status: 'active', notes: null };
}

function formFromCondition(condition: Condition): ConditionFormValues {
  return {
    name: condition.name,
    diagnosis_date: condition.diagnosis_date,
    doctor_name: condition.doctor_name,
    status: condition.status,
    notes: condition.notes,
  };
}

export function ConditionDialog({ open, onClose, condition }: Readonly<ConditionDialogProps>) {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const add = useAddCondition(userId);
  const update = useUpdateCondition();
  const isEditing = Boolean(condition);
  const mutation = isEditing ? update : add;

  const [form, setForm] = useState<ConditionFormValues>(emptyForm);

  useEffect(() => {
    if (open) setForm(condition ? formFromCondition(condition) : emptyForm());
  }, [open, condition]);

  function set<K extends keyof ConditionFormValues>(key: K, value: ConditionFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function close() {
    mutation.reset();
    onClose();
  }

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (isEditing && condition) {
      update.mutate({ id: condition.id, values: form }, { onSuccess: close });
    } else {
      add.mutate(form, { onSuccess: close });
    }
  }

  const submitError = mutation.isError
    ? "We couldn't save this condition. Please try again."
    : null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Modal open={open} onClose={close} title={isEditing ? 'Edit condition' : 'Add condition'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="condition-name">Condition</Label>
          <Input
            id="condition-name"
            required
            placeholder="e.g. Hypertension"
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
          />
        </div>

        <div className="flex gap-4">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="condition-date">Diagnosed on (optional)</Label>
            <Input
              id="condition-date"
              type="date"
              max={today}
              value={form.diagnosis_date ?? ''}
              onChange={(event) => set('diagnosis_date', event.target.value || null)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="condition-status">Status</Label>
            <Select
              id="condition-status"
              required
              value={form.status}
              onChange={(event) => set('status', event.target.value as ConditionStatus)}
            >
              {CONDITION_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {CONDITION_STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="condition-doctor">Diagnosing doctor (optional)</Label>
          <Input
            id="condition-doctor"
            value={form.doctor_name ?? ''}
            onChange={(event) => set('doctor_name', event.target.value || null)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="condition-notes">Notes (optional)</Label>
          <Textarea
            id="condition-notes"
            value={form.notes ?? ''}
            onChange={(event) => set('notes', event.target.value || null)}
          />
        </div>

        {submitError && <p className="text-sm text-destructive">{submitError}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save condition'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
