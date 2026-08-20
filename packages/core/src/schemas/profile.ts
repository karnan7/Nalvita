import { z } from 'zod';
import { BLOOD_GROUPS, GENDERS, NOTIFICATION_DETAIL_LEVELS } from '../constants.js';
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
  is_minor: z.boolean(),
  /**
   * How much a push notification may say on this person's lock screen.
   * 'generic' by default, so someone who never opens settings is the one who
   * gets the private behaviour rather than the leaky one.
   */
  notification_detail: z.enum(NOTIFICATION_DETAIL_LEVELS),
  created_at: isoDateTime,
  updated_at: isoDateTime,
});

export type Profile = z.infer<typeof profileSchema>;

/** Payload for updating a profile; ownership fields are never edited this way. */
export const profileUpdateSchema = profileSchema
  .omit({ id: true, user_id: true, managed_by: true, created_at: true, updated_at: true })
  .partial();

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

/**
 * Creating a profile for someone who has no account — the only kind of profile
 * the app ever inserts, since a person's own is made for them at signup.
 *
 * `managed_by` is set from the session at the call site, and `user_id` stays
 * null until they claim the profile. Only the few details a caregiver can
 * reasonably know up front are asked for; the rest is filled in later.
 */
export const managedProfileInsertSchema = z.object({
  full_name: z.string().min(1),
  date_of_birth: isoDate.nullable().default(null),
  gender: z.enum(GENDERS).nullable().default(null),
  blood_group: z.enum(BLOOD_GROUPS).nullable().default(null),
  is_minor: z.boolean().default(false),
});

export type ManagedProfileInsert = z.infer<typeof managedProfileInsertSchema>;

/** True when the profile has no account of its own and someone else runs it. */
export function isManagedProfile(profile: Pick<Profile, 'user_id' | 'managed_by'>): boolean {
  return profile.user_id === null && profile.managed_by !== null;
}
