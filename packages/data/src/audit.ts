import {
  auditEventSchema,
  auditFeedEntrySchema,
  type AuditEvent,
  type AuditFeedEntry,
  type LoggableAuditAction,
  type ShareCategory,
  type VitalType,
} from '@nalvita/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useInfiniteQuery, type QueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { useSupabase } from './client.js';

const feedPageSchema = z.array(auditFeedEntrySchema);

/** Narrows a share category to one that can name an actual record. */
export type AuditResourceType = Exclude<ShareCategory, 'all'>;

/** Entries per page; the RPC caps anything larger at 100. */
export const ACTIVITY_PAGE_SIZE = 20;

export const ACTIVITY_KEY = ['activity-feed'];

/**
 * Records something done in someone else's account.
 *
 * Safe to call after every read or write without checking whose records they
 * are: the database ignores actions on your own account, so the feed stays a
 * record of what *other people* did. Failures are swallowed — an audit write
 * must never break the action the person was actually trying to do, and the
 * error carries no detail worth surfacing to them.
 *
 * Takes the client explicitly because this runs from mutation callbacks, not
 * from a hook body — there is no React context to read at that point.
 */
export async function logAuditEvent(
  supabase: SupabaseClient,
  event: AuditEvent,
): Promise<void> {
  const parsed = auditEventSchema.safeParse(event);
  if (!parsed.success) return;

  const { owner_id, action, resource_type, resource_id } = parsed.data;
  try {
    await supabase.rpc('log_audit_event', {
      p_owner: owner_id,
      p_action: action,
      p_resource_type: resource_type,
      p_resource_id: resource_id,
    });
  } catch {
    // Deliberately swallowed: the person was doing something else, and a failed
    // audit write is neither their problem nor anything they can act on.
  }
}

/**
 * The minimum a record needs to be nameable in someone's feed. Deletes select
 * this back from the deleted row, since it is gone by the time we log.
 */
export const auditableRowSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
});

export type AuditableRow = z.infer<typeof auditableRowSchema>;

/**
 * Fire-and-forget audit for a record the app just read or wrote. Called from
 * mutation `onSuccess` handlers, so it must not return a promise the caller has
 * to await — the entry lands a moment after the action itself.
 */
export function auditRecord(
  supabase: SupabaseClient,
  action: LoggableAuditAction,
  resourceType: AuditResourceType,
  row: AuditableRow,
): void {
  void logAuditEvent(supabase, {
    owner_id: row.profile_id,
    action,
    resource_type: resourceType,
    resource_id: row.id,
  });
}

/**
 * Deletes a record and hands back just enough of it to say whose it was — the
 * row is gone by the time the mutation's `onSuccess` runs, so the audit entry
 * would otherwise have no owner to attribute it to.
 */
export async function deleteAuditedRecord(
  supabase: SupabaseClient,
  table: AuditResourceType,
  id: string,
): Promise<AuditableRow> {
  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)
    .select('id,profile_id')
    .single();
  if (error) throw error;
  return auditableRowSchema.parse(data);
}

/**
 * The `onSuccess` every audited record mutation wants: log what was done, then
 * refresh that table's list. Query keys are the table name throughout.
 */
export function auditedInvalidate<T extends AuditableRow>(
  supabase: SupabaseClient,
  queryClient: QueryClient,
  action: LoggableAuditAction,
  table: AuditResourceType,
): (row: T) => Promise<void> {
  return (row) => {
    auditRecord(supabase, action, table, row);
    return queryClient.invalidateQueries({ queryKey: [table] });
  };
}

interface FeedCursor {
  before_at: string;
  before_id: number;
}

/** The owner's activity feed: what other people did, newest first, paginated. */
export function useActivityFeed() {
  const supabase = useSupabase();
  return useInfiniteQuery({
    queryKey: ACTIVITY_KEY,
    initialPageParam: null as FeedCursor | null,
    queryFn: async ({ pageParam }): Promise<AuditFeedEntry[]> => {
      const { data, error } = await supabase.rpc('list_audit_feed', {
        p_limit: ACTIVITY_PAGE_SIZE,
        p_before_at: pageParam?.before_at ?? null,
        p_before_id: pageParam?.before_id ?? null,
      });
      if (error) throw error;
      return feedPageSchema.parse(data ?? []);
    },
    getNextPageParam: (lastPage): FeedCursor | null => {
      const last = lastPage[lastPage.length - 1];
      if (!last || lastPage.length < ACTIVITY_PAGE_SIZE) return null;
      return { before_at: last.created_at, before_id: last.id };
    },
  });
}

const RESOURCE_NOUNS: Record<string, string> = {
  profiles: 'profile details',
  documents: 'a document',
  medicines: 'a medicine',
  vitals: 'a reading',
  allergies: 'an allergy',
  conditions: 'a condition',
  doctors: 'a doctor',
};

const VITAL_LABELS: Record<VitalType, string> = {
  blood_pressure: 'blood pressure',
  blood_sugar_fasting: 'fasting blood sugar',
  blood_sugar_post_meal: 'post-meal blood sugar',
  weight: 'weight',
  heart_rate: 'heart rate',
};

/**
 * The record as a person would name it: its own label where it still exists,
 * a friendly vital name for readings, and a plain noun once it's deleted.
 */
function describeResource(entry: AuditFeedEntry): string {
  if (entry.resource_type === 'vitals') {
    const label = VITAL_LABELS[entry.resource_label as VitalType];
    return label ? `your ${label} reading` : 'a reading';
  }
  if (entry.resource_label) return `your ${entry.resource_label}`;
  return RESOURCE_NOUNS[entry.resource_type] ?? 'a record';
}

/** What someone is called in the feed when they haven't filled in a name. */
export function actorName(entry: AuditFeedEntry): string {
  return entry.actor_name?.trim() || 'A family member';
}

/**
 * One feed line in plain, non-clinical language — "Arjun viewed your Chest
 * X-ray". Verbs the app doesn't recognise (entries predating the shared
 * vocabulary) fall back to a truthful generic sentence rather than vanishing.
 */
export function describeAuditEntry(entry: AuditFeedEntry): string {
  const who = actorName(entry);
  switch (entry.action) {
    case 'joined_circle':
      return `${who} joined your circle`;
    case 'handed_over_profile':
      return `${who} handed this profile over to you — everything before this was added for you`;
    case 'viewed':
      return `${who} viewed ${describeResource(entry)}`;
    case 'added':
      return `${who} added ${describeResource(entry)}`;
    case 'updated':
      return `${who} updated ${describeResource(entry)}`;
    case 'deleted':
      return `${who} deleted ${describeResource(entry)}`;
    case 'sent_reminder':
      return `${who} sent you a reminder about ${describeResource(entry)}`;
    default:
      return `${who} made a change to ${describeResource(entry)}`;
  }
}

/** Time of day for a feed line, e.g. "2:14 PM". */
export function formatActivityTime(isoDateTime: string): string {
  return new Date(isoDateTime).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Day heading for a group of feed lines: Today, Yesterday, or a date. */
export function formatActivityDay(isoDateTime: string, now: Date = new Date()): string {
  const then = new Date(isoDateTime);
  const days = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()) /
      86_400_000,
  );
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return then.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export interface ActivityDay {
  day: string;
  entries: AuditFeedEntry[];
}

/** Groups a flat feed into day buckets so a busy account doesn't read as noise. */
export function groupByDay(entries: readonly AuditFeedEntry[], now?: Date): ActivityDay[] {
  const days: ActivityDay[] = [];
  for (const entry of entries) {
    const day = formatActivityDay(entry.created_at, now);
    const current = days[days.length - 1];
    if (current?.day === day) current.entries.push(entry);
    else days.push({ day, entries: [entry] });
  }
  return days;
}
