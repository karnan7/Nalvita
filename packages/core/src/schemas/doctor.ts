import { z } from 'zod';
import { isoDateTime } from './shared.js';

/** A doctor's contact card. */
export const doctorSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  name: z.string().min(1),
  specialty: z.string().nullable(),
  hospital: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  created_at: isoDateTime,
  updated_at: isoDateTime,
});

export type Doctor = z.infer<typeof doctorSchema>;

export const doctorInsertSchema = doctorSchema.omit({
  id: true,
  profile_id: true,
  created_at: true,
  updated_at: true,
});

export type DoctorInsert = z.infer<typeof doctorInsertSchema>;
