import { z } from 'zod';
import { BLOOD_GROUPS, GENDERS } from '../constants.js';
import { isoDate, isoDateTime } from './shared.js';

/**
 * A person's health profile, and the thing every health record belongs to.
 *
 * Created at signup and filled in afterwards, so all personal fields are
 * nullable. `user_id` is null for a managed profile — someone who has records
 * here but no account of their own — and `managed_by` names whoever operates
 * it until they claim it.
 */
export const profileSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  managed_by: z.string().uuid().nullable(),
  full_name: z.string().min(1).nullable(),
  date_of_birth: isoDate.nullable(),
  gender: z.enum(GENDERS).nullable(),
  blood_group: z.enum(BLOOD_GROUPS).nullable(),
  height_cm: z.number().positive().nullable(),
  weight_kg: z.number().positive().nullable(),
  created_at: isoDateTime,
  updated_at: isoDateTime,
});

export type Profile = z.infer<typeof profileSchema>;

/** Payload for updating a profile; ownership fields are never edited this way. */
export const profileUpdateSchema = profileSchema
  .omit({ id: true, user_id: true, managed_by: true, created_at: true, updated_at: true })
  .partial();

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
