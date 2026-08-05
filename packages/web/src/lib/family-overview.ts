import {
  documentSchema,
  medicineSchema,
  profileSchema,
  vitalSchema,
  type CirclePerson,
  type Document,
  type Medicine,
  type Vital,
} from '@nalvita/core';
import { useQueries } from '@tanstack/react-query';
import { z } from 'zod';

import { activeMedicines, lastCheckupDate, refillDueCount } from '@/lib/dashboard';
import { allowsCategory } from '@/lib/circle';
import { supabase } from '@/lib/supabase';

/** A reading older than this means nobody has checked in on them lately. */
export const STALE_VITALS_DAYS = 7;

/** Why a person's card is asking for attention. Order is display order. */
export type AttentionKind = 'refill-due' | 'no-recent-vitals';

export interface Attention {
  kind: AttentionKind;
  label: string;
}

/**
 * What one family card shows. Every field is optional in the sense that a
 * category the owner has not shared is simply absent — the card says less
 * rather than showing a permission error.
 */
export interface FamilySummary {
  person: CirclePerson;
  /** Their date of birth, when 'profiles' is shared; used only for the age. */
  dateOfBirth: string | null;
  medicines: Medicine[] | null;
  latestVital: Vital | null;
  lastCheckup: string | null;
  attentions: Attention[];
}

const medicineListSchema = z.array(medicineSchema);
const vitalListSchema = z.array(vitalSchema);
const documentListSchema = z.array(documentSchema);

/** Whole days between two instants, rounded down. */
function daysSince(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
}

/**
 * The chips that make a card stand out. Only categories the owner shared can
 * raise one: silence about vitals you cannot see is honest, an "all clear" is
 * not.
 */
export function attentionsFor(
  person: CirclePerson,
  medicines: Medicine[] | null,
  latestVital: Vital | null,
  now: Date = new Date(),
): Attention[] {
  const attentions: Attention[] = [];

  if (medicines) {
    const due = refillDueCount(medicines);
    if (due > 0) {
      attentions.push({
        kind: 'refill-due',
        label: due === 1 ? '1 refill due' : `${due} refills due`,
      });
    }
  }

  if (allowsCategory(person, 'vitals')) {
    const stale = !latestVital || daysSince(latestVital.measured_at, now) >= STALE_VITALS_DAYS;
    if (stale) {
      attentions.push({ kind: 'no-recent-vitals', label: 'No readings this week' });
    }
  }

  return attentions;
}

/** Cards needing attention float to the top; the rest keep their name order. */
export function sortByAttention(summaries: readonly FamilySummary[]): FamilySummary[] {
  return [...summaries].sort((a, b) => b.attentions.length - a.attentions.length);
}

/** Reads everything one card needs, skipping categories that aren't shared. */
async function loadSummary(person: CirclePerson): Promise<FamilySummary> {
  const owner = person.counterpart_id;

  const [dateOfBirth, medicines, latestVital, lastCheckup] = await Promise.all([
    loadDateOfBirth(person, owner),
    loadMedicines(person, owner),
    loadLatestVital(person, owner),
    loadLastCheckup(person, owner),
  ]);

  return {
    person,
    dateOfBirth,
    medicines,
    latestVital,
    lastCheckup,
    attentions: attentionsFor(person, medicines, latestVital),
  };
}

async function loadDateOfBirth(person: CirclePerson, owner: string): Promise<string | null> {
  if (!allowsCategory(person, 'profiles')) return null;
  const { data } = await supabase.from('profiles').select('*').eq('user_id', owner).maybeSingle();
  if (!data) return null;
  return profileSchema.parse(data).date_of_birth;
}

async function loadMedicines(person: CirclePerson, owner: string): Promise<Medicine[] | null> {
  if (!allowsCategory(person, 'medicines')) return null;
  const { data, error } = await supabase.from('medicines').select('*').eq('user_id', owner);
  if (error) throw error;
  return medicineListSchema.parse(data);
}

async function loadLatestVital(person: CirclePerson, owner: string): Promise<Vital | null> {
  if (!allowsCategory(person, 'vitals')) return null;
  const { data, error } = await supabase
    .from('vitals')
    .select('*')
    .eq('user_id', owner)
    .order('measured_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return vitalListSchema.parse(data)[0] ?? null;
}

async function loadLastCheckup(person: CirclePerson, owner: string): Promise<string | null> {
  if (!allowsCategory(person, 'documents')) return null;
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', owner)
    .eq('category', 'consultation');
  if (error) throw error;
  return lastCheckupDate(documentListSchema.parse(data) as Document[]);
}

/** How many medicines they are currently on, or null when not shared. */
export function activeMedicineCount(medicines: Medicine[] | null): number | null {
  return medicines ? activeMedicines(medicines).length : null;
}

/**
 * One aggregated read per person, in parallel. Categories are filtered client
 * side too, so we never ask for something RLS would refuse — but RLS remains
 * what actually enforces it.
 */
export function useFamilyOverview(people: readonly CirclePerson[]) {
  return useQueries({
    queries: people.map((person) => ({
      queryKey: ['family-summary', person.counterpart_id, person.shared_categories.join(',')],
      queryFn: () => loadSummary(person),
    })),
    combine: (results) => ({
      summaries: sortByAttention(
        results.flatMap((result) => (result.data ? [result.data] : [])),
      ),
      isPending: results.some((result) => result.isPending),
      isError: results.some((result) => result.isError),
    }),
  });
}
