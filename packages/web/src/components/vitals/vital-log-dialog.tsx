import { VITAL_TYPES, type Vital, type VitalType } from '@nalvita/core';
import { useEffect, useState, type SyntheticEvent } from 'react';

import { useActiveProfile } from '@/lib/active-profile-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  localFromMeasuredAt,
  measuredAtFromLocal,
  useLogVital,
  useUpdateVital,
  VITAL_TYPE_LABELS,
  VITAL_UNITS,
  type VitalFormValues,
} from '@/lib/vitals';

interface VitalLogDialogProps {
  open: boolean;
  onClose: () => void;
  /** When set, the form corrects this reading instead of logging a new one. */
  vital?: Vital | null;
  /** Pre-selects the type when logging a new reading. */
  defaultType?: VitalType;
}

interface FormState {
  type: VitalType;
  value1: string;
  value2: string;
  measuredAtLocal: string;
  notes: string;
}

function nowLocal(): string {
  return localFromMeasuredAt(new Date().toISOString());
}

function emptyState(type: VitalType): FormState {
  return { type, value1: '', value2: '', measuredAtLocal: nowLocal(), notes: '' };
}

function stateFromVital(vital: Vital): FormState {
  return {
    type: vital.type,
    value1: String(vital.value_1),
    value2: vital.value_2 === null ? '' : String(vital.value_2),
    measuredAtLocal: localFromMeasuredAt(vital.measured_at),
    notes: vital.notes ?? '',
  };
}

export function VitalLogDialog({ open, onClose, vital, defaultType }: Readonly<VitalLogDialogProps>) {
  const { profileId } = useActiveProfile();
  const log = useLogVital(profileId);
  const update = useUpdateVital();
  const isEditing = Boolean(vital);
  const mutation = isEditing ? update : log;

  const [form, setForm] = useState<FormState>(() => emptyState(defaultType ?? 'blood_pressure'));

  useEffect(() => {
    if (open) setForm(vital ? stateFromVital(vital) : emptyState(defaultType ?? 'blood_pressure'));
  }, [open, vital, defaultType]);

  const isBloodPressure = form.type === 'blood_pressure';

  function close() {
    mutation.reset();
    onClose();
  }

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    const value1 = Number(form.value1);
    const value2 = form.value2 === '' ? null : Number(form.value2);
    if (Number.isNaN(value1)) return;
    if (isBloodPressure && (value2 === null || Number.isNaN(value2))) return;

    const values: VitalFormValues = {
      type: form.type,
      value_1: value1,
      value_2: isBloodPressure ? value2 : null,
      measured_at: measuredAtFromLocal(form.measuredAtLocal),
      notes: form.notes.trim() || null,
    };

    if (isEditing && vital) update.mutate({ id: vital.id, values }, { onSuccess: close });
    else log.mutate(values, { onSuccess: close });
  }

  const submitError = mutation.isError ? "We couldn't save this reading. Please try again." : null;

  return (
    <Modal open={open} onClose={close} title={isEditing ? 'Edit reading' : 'Log vitals'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="vital-type">What did you measure?</Label>
          <Select
            id="vital-type"
            required
            disabled={isEditing}
            value={form.type}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, type: event.target.value as VitalType }))
            }
          >
            {VITAL_TYPES.map((value) => (
              <option key={value} value={value}>
                {VITAL_TYPE_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>

        {isBloodPressure ? (
          <div className="flex gap-4">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="vital-systolic">Systolic (mmHg)</Label>
              <Input
                id="vital-systolic"
                type="number"
                inputMode="numeric"
                required
                min={0}
                value={form.value1}
                onChange={(event) => setForm((prev) => ({ ...prev, value1: event.target.value }))}
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="vital-diastolic">Diastolic (mmHg)</Label>
              <Input
                id="vital-diastolic"
                type="number"
                inputMode="numeric"
                required
                min={0}
                value={form.value2}
                onChange={(event) => setForm((prev) => ({ ...prev, value2: event.target.value }))}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="vital-value">Reading ({VITAL_UNITS[form.type]})</Label>
            <Input
              id="vital-value"
              type="number"
              inputMode="decimal"
              required
              min={0}
              step="any"
              value={form.value1}
              onChange={(event) => setForm((prev) => ({ ...prev, value1: event.target.value }))}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="vital-measured-at">When</Label>
          <Input
            id="vital-measured-at"
            type="datetime-local"
            required
            max={nowLocal()}
            value={form.measuredAtLocal}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, measuredAtLocal: event.target.value }))
            }
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="vital-notes">Notes (optional)</Label>
          <Textarea
            id="vital-notes"
            placeholder="e.g. after morning walk"
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          />
        </div>

        {submitError && <p className="text-sm text-destructive">{submitError}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save reading'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
