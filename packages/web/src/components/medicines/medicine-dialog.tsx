import {
  MEDICINE_FREQUENCIES,
  MEDICINE_TIMINGS,
  type Medicine,
  type MedicineFrequency,
  type MedicineTiming,
} from '@nalvita/core';
import { useEffect, useState, type SyntheticEvent } from 'react';

import { MEDICINE_FREQUENCY_LABELS, MEDICINE_TIMING_LABELS, todayIso, useActiveProfile, useAddMedicine, useUpdateMedicine, type MedicineFormValues } from '@nalvita/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface MedicineDialogProps {
  open: boolean;
  onClose: () => void;
  /** When set, the form edits this medicine instead of adding a new one. */
  medicine?: Medicine | null;
}

function emptyForm(): MedicineFormValues {
  return {
    name: '',
    dosage: '',
    frequency: 'once_daily',
    timings: [],
    doctor_name: null,
    start_date: todayIso(),
    end_date: null,
    refill_date: null,
    notes: null,
  };
}

function formFromMedicine(medicine: Medicine): MedicineFormValues {
  return {
    name: medicine.name,
    dosage: medicine.dosage,
    frequency: medicine.frequency,
    timings: medicine.timings,
    doctor_name: medicine.doctor_name,
    start_date: medicine.start_date,
    end_date: medicine.end_date,
    refill_date: medicine.refill_date,
    notes: medicine.notes,
  };
}

export function MedicineDialog({ open, onClose, medicine }: Readonly<MedicineDialogProps>) {
  const { profileId } = useActiveProfile();
  const add = useAddMedicine(profileId);
  const update = useUpdateMedicine();
  const isEditing = Boolean(medicine);
  const mutation = isEditing ? update : add;

  const [form, setForm] = useState<MedicineFormValues>(emptyForm);

  // Reload the form whenever the dialog opens for a different medicine.
  useEffect(() => {
    if (open) setForm(medicine ? formFromMedicine(medicine) : emptyForm());
  }, [open, medicine]);

  function set<K extends keyof MedicineFormValues>(key: K, value: MedicineFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleTiming(timing: MedicineTiming) {
    setForm((prev) => ({
      ...prev,
      timings: prev.timings.includes(timing)
        ? prev.timings.filter((t) => t !== timing)
        : [...prev.timings, timing],
    }));
  }

  function close() {
    mutation.reset();
    onClose();
  }

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (isEditing && medicine) {
      update.mutate({ id: medicine.id, values: form }, { onSuccess: close });
    } else {
      add.mutate(form, { onSuccess: close });
    }
  }

  const submitError = mutation.isError ? "We couldn't save this medicine. Please try again." : null;

  return (
    <Modal open={open} onClose={close} title={isEditing ? 'Edit medicine' : 'Add medicine'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="med-name">Name</Label>
          <Input
            id="med-name"
            required
            placeholder="e.g. Metformin"
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="med-dosage">Dosage</Label>
          <Input
            id="med-dosage"
            required
            placeholder="e.g. 500mg"
            value={form.dosage}
            onChange={(event) => set('dosage', event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="med-frequency">How often</Label>
          <Select
            id="med-frequency"
            required
            value={form.frequency}
            onChange={(event) => set('frequency', event.target.value as MedicineFrequency)}
          >
            {MEDICINE_FREQUENCIES.map((value) => (
              <option key={value} value={value}>
                {MEDICINE_FREQUENCY_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">When to take it (optional)</legend>
          <div className="flex flex-wrap gap-4">
            {MEDICINE_TIMINGS.map((timing) => (
              <label key={timing} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={form.timings.includes(timing)}
                  onChange={() => toggleTiming(timing)}
                />
                {MEDICINE_TIMING_LABELS[timing]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor="med-doctor">Prescribing doctor (optional)</Label>
          <Input
            id="med-doctor"
            value={form.doctor_name ?? ''}
            onChange={(event) => set('doctor_name', event.target.value || null)}
          />
        </div>

        <div className="flex gap-4">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="med-start">Start date</Label>
            <Input
              id="med-start"
              type="date"
              required
              value={form.start_date}
              onChange={(event) => set('start_date', event.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="med-end">End date (optional)</Label>
            <Input
              id="med-end"
              type="date"
              min={form.start_date}
              value={form.end_date ?? ''}
              onChange={(event) => set('end_date', event.target.value || null)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="med-refill">Refill date (optional)</Label>
          <Input
            id="med-refill"
            type="date"
            value={form.refill_date ?? ''}
            onChange={(event) => set('refill_date', event.target.value || null)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="med-notes">Notes (optional)</Label>
          <Textarea
            id="med-notes"
            placeholder="e.g. Take after meals"
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
            {mutation.isPending ? 'Saving…' : 'Save medicine'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
