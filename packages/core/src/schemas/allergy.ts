import { z } from 'zod';
import { ALLERGY_SEVERITIES } from '../constants.js';
import { isoDateTime } from './shared.js';

/** An allergy shown in the dashboard's red alert banner. */
export const allergySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  allergen: z.string().min(1),
  severity: z.enum(ALLERGY_SEVERITIES),
  reaction: z.string().nullable(),
  created_at: isoDateTime,
  updated_at: isoDateTime,
});

export type Allergy = z.infer<typeof allergySchema>;

export const allergyInsertSchema = allergySchema.omit({
  id: true,
  user_id: true,
  created_at: true,
  updated_at: true,
});

export type AllergyInsert = z.infer<typeof allergyInsertSchema>;
