import { z } from 'zod';
import { CONDITION_STATUSES } from '../constants.js';
import { isoDate, isoDateTime } from './shared.js';

/** A diagnosed medical condition. */
export const conditionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().min(1),
  diagnosis_date: isoDate.nullable(),
  doctor_name: z.string().nullable(),
  status: z.enum(CONDITION_STATUSES),
  notes: z.string().nullable(),
  created_at: isoDateTime,
  updated_at: isoDateTime,
});

export type Condition = z.infer<typeof conditionSchema>;

export const conditionInsertSchema = conditionSchema.omit({
  id: true,
  user_id: true,
  created_at: true,
  updated_at: true,
});

export type ConditionInsert = z.infer<typeof conditionInsertSchema>;
