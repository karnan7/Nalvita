import { z } from 'zod';
import { LOGGABLE_AUDIT_ACTIONS, SHARE_CATEGORIES } from '../constants.js';
import { isoDateTime } from './shared.js';

/** An append-only audit trail entry; only the owner can read their log. */
export const auditLogSchema = z.object({
  id: z.number().int().positive(),
  actor_id: z.string().uuid(),
  owner_id: z.string().uuid(),
  action: z.string().min(1),
  resource_type: z.string().min(1),
  resource_id: z.string().uuid().nullable(),
  created_at: isoDateTime,
});

export type AuditLog = z.infer<typeof auditLogSchema>;

/** Payload for appending an audit entry; actor_id comes from the session. */
export const auditLogInsertSchema = auditLogSchema.omit({
  id: true,
  actor_id: true,
  created_at: true,
});

export type AuditLogInsert = z.infer<typeof auditLogInsertSchema>;

/**
 * Arguments for the `log_audit_event` RPC. The actor is always derived from the
 * session server-side, so it is deliberately absent here. `resource_type` is a
 * real share category — 'all' is a wildcard for permissions, never a record.
 */
export const auditEventSchema = z.object({
  owner_id: z.string().uuid(),
  action: z.enum(LOGGABLE_AUDIT_ACTIONS),
  resource_type: z.enum(SHARE_CATEGORIES).exclude(['all']),
  resource_id: z.string().uuid().nullable().default(null),
});

export type AuditEvent = z.input<typeof auditEventSchema>;

/**
 * A row from the `list_audit_feed` RPC: an entry someone else made in my
 * account, with their display name and the record's label resolved at read
 * time. `action` stays a plain string so entries written before the verb
 * vocabulary existed still render (as a generic sentence) instead of throwing.
 */
export const auditFeedEntrySchema = z.object({
  id: z.number().int().positive(),
  actor_id: z.string().uuid(),
  actor_name: z.string().nullable(),
  action: z.string().min(1),
  resource_type: z.string().min(1),
  resource_id: z.string().uuid().nullable(),
  resource_label: z.string().nullable(),
  created_at: isoDateTime,
});

export type AuditFeedEntry = z.infer<typeof auditFeedEntrySchema>;
