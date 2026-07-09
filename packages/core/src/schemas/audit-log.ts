import { z } from 'zod';
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
