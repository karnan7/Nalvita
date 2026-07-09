import { z } from 'zod';
import { DOCUMENT_CATEGORIES, MAX_DOCUMENT_SIZE_BYTES } from '../constants.js';
import { isoDate, isoDateTime } from './shared.js';

/** A medical document stored in the private `health-documents` bucket. */
export const documentSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string().min(1),
  category: z.enum(DOCUMENT_CATEGORIES),
  doctor_name: z.string().nullable(),
  doc_date: isoDate.nullable(),
  file_path: z.string().min(1),
  file_type: z.string().min(1),
  file_size: z.number().int().positive().max(MAX_DOCUMENT_SIZE_BYTES),
  notes: z.string().nullable(),
  created_at: isoDateTime,
});

export type Document = z.infer<typeof documentSchema>;

/** Payload for creating a document row after upload. */
export const documentInsertSchema = documentSchema.omit({
  id: true,
  user_id: true,
  created_at: true,
});

export type DocumentInsert = z.infer<typeof documentInsertSchema>;
