import { z } from 'zod';

/** Calendar date as YYYY-MM-DD (Postgres `date`). */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date in YYYY-MM-DD format');

/** Timestamp with timezone (Postgres `timestamptz`). */
export const isoDateTime = z.string().datetime({ offset: true });
