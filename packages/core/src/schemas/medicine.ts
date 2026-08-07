import { z } from 'zod';
import { MEDICINE_FREQUENCIES, MEDICINE_STATUSES, MEDICINE_TIMINGS } from '../constants.js';
import { isoDate, isoDateTime } from './shared.js';

/** A current or past medicine with dosage and schedule. */
export const medicineSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  name: z.string().min(1),
  dosage: z.string().min(1),
  frequency: z.enum(MEDICINE_FREQUENCIES),
  timings: z.array(z.enum(MEDICINE_TIMINGS)),
  doctor_name: z.string().nullable(),
  start_date: isoDate,
  end_date: isoDate.nullable(),
  refill_date: isoDate.nullable(),
  status: z.enum(MEDICINE_STATUSES),
  notes: z.string().nullable(),
  created_at: isoDateTime,
  updated_at: isoDateTime,
});

export type Medicine = z.infer<typeof medicineSchema>;

/** Payload for adding a medicine; status defaults to active. */
export const medicineInsertSchema = medicineSchema
  .omit({ id: true, profile_id: true, created_at: true, updated_at: true })
  .extend({
    status: z.enum(MEDICINE_STATUSES).default('active'),
  });

export type MedicineInsert = z.infer<typeof medicineInsertSchema>;
