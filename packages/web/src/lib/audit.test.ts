import type { AuditFeedEntry } from '@nalvita/core';
import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  actorName,
  auditRecord,
  auditedInvalidate,
  deleteAuditedRecord,
  describeAuditEntry,
  formatActivityDay,
  groupByDay,
  logAuditEvent,
} from './audit';
import { supabase } from '@/lib/supabase';

const OWNER = '00000000-0000-4000-8000-000000000001';
const ACTOR = '00000000-0000-4000-8000-000000000002';
const RECORD = '00000000-0000-4000-8000-0000000000d1';

function entry(overrides: Partial<AuditFeedEntry> = {}): AuditFeedEntry {
  return {
    id: 1,
    actor_id: ACTOR,
    actor_name: 'Appa',
    action: 'viewed',
    resource_type: 'documents',
    resource_id: RECORD,
    resource_label: 'Chest X-ray',
    created_at: '2026-08-04T08:00:00.000Z',
    ...overrides,
  };
}

describe('describeAuditEntry', () => {
  it('names the record when it still exists', () => {
    expect(describeAuditEntry(entry())).toBe('Appa viewed your Chest X-ray');
  });

  it('falls back to a plain noun once the record is gone', () => {
    expect(describeAuditEntry(entry({ action: 'deleted', resource_label: null }))).toBe(
      'Appa deleted a document',
    );
  });

  it('turns a stored vital type into words', () => {
    expect(
      describeAuditEntry(
        entry({ action: 'added', resource_type: 'vitals', resource_label: 'blood_pressure' }),
      ),
    ).toBe('Appa added your blood pressure reading');
  });

  it('reads joining a circle as its own event', () => {
    expect(
      describeAuditEntry(
        entry({ action: 'joined_circle', resource_type: 'circle', resource_label: null }),
      ),
    ).toBe('Appa joined your circle');
  });

  it('still says something truthful for a verb it does not know', () => {
    expect(describeAuditEntry(entry({ action: 'viewed_document' }))).toBe(
      'Appa made a change to your Chest X-ray',
    );
  });

  it('has a respectful name for someone who never filled one in', () => {
    expect(actorName(entry({ actor_name: null }))).toBe('A family member');
    expect(actorName(entry({ actor_name: '  ' }))).toBe('A family member');
  });
});

describe('formatActivityDay', () => {
  const now = new Date('2026-08-04T10:00:00');

  it('says Today and Yesterday before falling back to a date', () => {
    expect(formatActivityDay('2026-08-04T08:00:00', now)).toBe('Today');
    expect(formatActivityDay('2026-08-03T23:30:00', now)).toBe('Yesterday');
    expect(formatActivityDay('2026-07-30T09:00:00', now)).not.toMatch(/Today|Yesterday/);
  });
});

describe('groupByDay', () => {
  it('buckets consecutive entries from the same day together', () => {
    const now = new Date('2026-08-04T10:00:00');
    const days = groupByDay(
      [
        entry({ id: 3, created_at: '2026-08-04T09:00:00' }),
        entry({ id: 2, created_at: '2026-08-04T08:00:00' }),
        entry({ id: 1, created_at: '2026-08-03T20:00:00' }),
      ],
      now,
    );

    expect(days.map((d) => d.day)).toEqual(['Today', 'Yesterday']);
    expect(days[0]!.entries).toHaveLength(2);
  });

  it('has nothing to group when the feed is empty', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe('logAuditEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);
  });

  it('sends the event through the RPC, never a direct table write', async () => {
    await logAuditEvent({
      owner_id: OWNER,
      action: 'viewed',
      resource_type: 'documents',
      resource_id: RECORD,
    });

    expect(supabase.rpc).toHaveBeenCalledWith('log_audit_event', {
      p_owner: OWNER,
      p_action: 'viewed',
      p_resource_type: 'documents',
      p_resource_id: RECORD,
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('drops an event the shared vocabulary does not allow', async () => {
    await logAuditEvent({
      owner_id: OWNER,
      // Deliberately outside the vocabulary — this is the guard being tested.
      action: 'tampered' as never,
      resource_type: 'documents',
    });

    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('never rejects when the audit write itself fails', async () => {
    vi.mocked(supabase.rpc).mockRejectedValue(new Error('offline') as never);

    await expect(
      logAuditEvent({ owner_id: OWNER, action: 'added', resource_type: 'vitals' }),
    ).resolves.toBeUndefined();
  });

  it('logs a record against its owner, not the person acting', () => {
    auditRecord('updated', 'medicines', { id: RECORD, profile_id: OWNER });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'log_audit_event',
      expect.objectContaining({ p_owner: OWNER, p_action: 'updated' }),
    );
  });
});

describe('deleteAuditedRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects the owner back from the deleted row', async () => {
    const single = vi.fn(async () => ({ data: { id: RECORD, profile_id: OWNER }, error: null }));
    vi.mocked(supabase.from).mockReturnValue({
      delete: () => ({ eq: () => ({ select: () => ({ single }) }) }),
    } as never);

    await expect(deleteAuditedRecord('vitals', RECORD)).resolves.toEqual({
      id: RECORD,
      profile_id: OWNER,
    });
    expect(supabase.from).toHaveBeenCalledWith('vitals');
  });

  it('surfaces a refused delete instead of logging one that never happened', async () => {
    const single = vi.fn(async () => ({ data: null, error: { code: '42501' } }));
    vi.mocked(supabase.from).mockReturnValue({
      delete: () => ({ eq: () => ({ select: () => ({ single }) }) }),
    } as never);

    await expect(deleteAuditedRecord('vitals', RECORD)).rejects.toMatchObject({ code: '42501' });
  });
});

describe('auditedInvalidate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);
  });

  it("logs the action and refreshes that table's list", async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();

    await auditedInvalidate(queryClient, 'deleted', 'allergies')({ id: RECORD, profile_id: OWNER });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'log_audit_event',
      expect.objectContaining({ p_action: 'deleted', p_resource_type: 'allergies' }),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['allergies'] });
  });
});
