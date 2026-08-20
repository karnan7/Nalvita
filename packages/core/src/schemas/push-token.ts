import { z } from 'zod';
import { NOTIFICATION_TYPES, PUSH_PLATFORMS } from '../constants.js';
import { isoDateTime } from './shared.js';

/**
 * A device registered to receive push notifications (KAR-52).
 *
 * Scoped to the account rather than the profile: a device belongs to the person
 * holding it, and a managed profile has no device of its own.
 */
export const pushTokenSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  token: z.string().min(1),
  platform: z.enum(PUSH_PLATFORMS),
  /** What a person would recognise in a device list — never more than that. */
  device_label: z.string().nullable(),
  last_seen_at: isoDateTime,
  created_at: isoDateTime,
});

export type PushToken = z.infer<typeof pushTokenSchema>;

/** Registering a device; the account comes from the session. */
export const pushTokenInsertSchema = pushTokenSchema.omit({
  id: true,
  user_id: true,
  last_seen_at: true,
  created_at: true,
});

export type PushTokenInsert = z.infer<typeof pushTokenInsertSchema>;

/**
 * One row of delivery history: counts and a type, never a payload.
 *
 * There is no insert schema on purpose. Only the send function writes here,
 * running as service_role; the app can read its own history and nothing else.
 */
export const notificationSendSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.string().uuid(),
  notification_type: z.string().min(1),
  device_count: z.number().int().nonnegative(),
  delivered_count: z.number().int().nonnegative(),
  failed_count: z.number().int().nonnegative(),
  created_at: isoDateTime,
});

export type NotificationSend = z.infer<typeof notificationSendSchema>;

/**
 * What a feature hands to the send function.
 *
 * `body` is what a fully-detailed notification would say; `genericBody` is what
 * the same notification says when the recipient has not opted into detail. Both
 * are required rather than the generic one being derived, because only the
 * feature knows how to say its own thing without naming a medicine — a
 * truncation rule applied here would leak by accident.
 */
export const notificationPayloadSchema = z.object({
  user_id: z.string().uuid(),
  type: z.enum(NOTIFICATION_TYPES),
  title: z.string().min(1),
  body: z.string().min(1),
  genericBody: z.string().min(1),
  /** Where tapping the notification should land. Never a health value. */
  route: z.string().min(1).optional(),
});

export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;
