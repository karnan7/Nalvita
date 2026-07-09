import { z } from 'zod';
import { BLOOD_GROUPS, GENDERS } from '../constants.js';
import { isoDate, isoDateTime } from './shared.js';

/**
 * A user's health profile. Created at signup and filled in
 * afterwards, so all personal fields are nullable.
 */
export const profileSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
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

/** Payload for updating one's own profile. */
export const profileUpdateSchema = profileSchema
  .omit({ id: true, user_id: true, created_at: true, updated_at: true })
  .partial();

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
