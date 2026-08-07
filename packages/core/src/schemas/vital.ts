import { z } from 'zod';
import { VITAL_TYPES } from '../constants.js';
import { isoDateTime } from './shared.js';

/**
 * A single vitals reading. `value_2` holds the diastolic value and is
 * required for blood pressure readings; other vital types use `value_1` alone.
 */
export const vitalSchema = z
  .object({
    id: z.string().uuid(),
    profile_id: z.string().uuid(),
    type: z.enum(VITAL_TYPES),
    value_1: z.number(),
    value_2: z.number().nullable(),
    unit: z.string().min(1),
    measured_at: isoDateTime,
    notes: z.string().nullable(),
    created_at: isoDateTime,
  })
  .refine((v) => v.type !== 'blood_pressure' || v.value_2 !== null, {
    message: 'Blood pressure readings require a diastolic value in value_2',
    path: ['value_2'],
  });

export type Vital = z.infer<typeof vitalSchema>;

/** Payload for logging a reading. */
export const vitalInsertSchema = z
  .object({
    type: z.enum(VITAL_TYPES),
    value_1: z.number(),
    value_2: z.number().nullable().default(null),
    unit: z.string().min(1),
    measured_at: isoDateTime,
    notes: z.string().nullable().default(null),
  })
  .refine((v) => v.type !== 'blood_pressure' || v.value_2 !== null, {
    message: 'Blood pressure readings require a diastolic value in value_2',
    path: ['value_2'],
  });

export type VitalInsert = z.infer<typeof vitalInsertSchema>;
