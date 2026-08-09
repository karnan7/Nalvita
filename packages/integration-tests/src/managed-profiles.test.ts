import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestUser, deleteTestUsers, type TestUser } from './helpers/clients.js';
import { createClaim, createManagedProfile } from './helpers/managed.js';
import { insertPayload } from './helpers/seed.js';

/**
 * Managed profiles and handover (KAR-53), against real RLS.
 *
 * The invariants worth failing CI over: a manager reaches only their own
 * people, the cap holds in the database, and the handover is two-sided,
 * atomic, and loses no history.
 *
 * Every test takes a fresh manager rather than sharing one — the cap is real,
 * and six profiles into the suite a shared manager would start failing for a
 * reason that has nothing to do with what the test is checking.
 */

let stranger: TestUser;
const people: TestUser[] = [];

async function newUser(label: string): Promise<TestUser> {
  const user = await createTestUser(label);
  people.push(user);
  return user;
}

beforeAll(async () => {
  stranger = await createTestUser('mp-stranger');
});

afterAll(async () => {
  await deleteTestUsers(stranger, ...people);
});

describe('creating a profile for someone with no account', () => {
  it('is readable and writable by its manager', async () => {
    const manager = await newUser('mp-create');
    const profileId = await createManagedProfile(manager, { full_name: 'Amma' });

    const { data: read } = await manager.client
      .from('profiles')
      .select('full_name,user_id,managed_by')
      .eq('id', profileId)
      .single();
    expect(read!.full_name).toBe('Amma');
    expect(read!.user_id).toBeNull();
    expect(read!.managed_by).toBe(manager.id);

    const { error } = await manager.client
      .from('vitals')
      .insert(insertPayload('vitals', { id: manager.id, profileId }));
    expect(error).toBeNull();
  });

  it('is invisible to everyone else', async () => {
    const manager = await newUser('mp-private');
    const profileId = await createManagedProfile(manager, { full_name: 'Private' });

    const { data } = await stranger.client.from('profiles').select('id').eq('id', profileId);
    expect(data).toEqual([]);
  });

  it('cannot be created with somebody else named as the manager', async () => {
    const manager = await newUser('mp-not-mine');

    const { error } = await stranger.client
      .from('profiles')
      .insert({ managed_by: manager.id, full_name: 'Not yours' });
    expect(error).not.toBeNull();
  });

  it('cannot be created already owning an account', async () => {
    const manager = await newUser('mp-hijack');

    const { error } = await manager.client
      .from('profiles')
      .insert({ managed_by: manager.id, user_id: stranger.id, full_name: 'Hijack' });
    expect(error).not.toBeNull();
  });

  it("keeps its records separate from the manager's own", async () => {
    const manager = await newUser('mp-separate');
    const profileId = await createManagedProfile(manager, { full_name: 'Separate' });

    await manager.client
      .from('vitals')
      .insert(insertPayload('vitals', { id: manager.id, profileId }));

    const { data: theirs } = await manager.client
      .from('vitals')
      .select('id')
      .eq('profile_id', profileId);
    const { data: mine } = await manager.client
      .from('vitals')
      .select('id')
      .eq('profile_id', manager.profileId);
    expect(theirs).toHaveLength(1);
    expect(mine).toHaveLength(0);
  });

  it('can be marked as a child', async () => {
    const manager = await newUser('mp-child');
    const profileId = await createManagedProfile(manager, {
      full_name: 'Kiran',
      is_minor: true,
    });

    const { data } = await manager.client
      .from('profiles')
      .select('is_minor')
      .eq('id', profileId)
      .single();
    expect(data!.is_minor).toBe(true);
  });
});

describe('the cap', () => {
  it('stops the seventh profile, in the database', async () => {
    const collector = await newUser('mp-cap');

    for (let index = 0; index < 6; index++) {
      await createManagedProfile(collector, { full_name: `Person ${index}` });
    }

    const { error } = await collector.client
      .from('profiles')
      .insert({ managed_by: collector.id, full_name: 'One too many' });
    expect(error).not.toBeNull();
    expect(error!.message).toContain('6 profiles');

    const { data } = await collector.client
      .from('profiles')
      .select('id')
      .eq('managed_by', collector.id)
      .is('user_id', null);
    expect(data).toHaveLength(6);
  });
});

describe('the claim preview', () => {
  it('describes the profile to whoever holds the secret, without the records', async () => {
    const manager = await newUser('mp-preview-mgr');
    const profileId = await createManagedProfile(manager, { full_name: 'Preview Person' });
    await manager.client
      .from('vitals')
      .insert(insertPayload('vitals', { id: manager.id, profileId }));
    const claim = await createClaim(manager, profileId);
    const claimant = await newUser('mp-preview');

    const { data, error } = await claimant.client.rpc('preview_profile_claim', {
      p_secret: claim.token,
    });
    expect(error).toBeNull();
    expect(data![0].profile_name).toBe('Preview Person');
    expect(data![0].record_count).toBe(1);
    expect(data![0].already_claimed).toBe(false);
  });

  it('works from the 6-digit code too', async () => {
    const manager = await newUser('mp-code-mgr');
    const profileId = await createManagedProfile(manager, { full_name: 'By Code' });
    const claim = await createClaim(manager, profileId);
    const claimant = await newUser('mp-code');

    const { data, error } = await claimant.client.rpc('preview_profile_claim', {
      p_secret: claim.code,
    });
    expect(error).toBeNull();
    expect(data![0].profile_name).toBe('By Code');
  });

  it('refuses a secret that matches nothing', async () => {
    const claimant = await newUser('mp-bad-secret');
    const { error } = await claimant.client.rpc('preview_profile_claim', {
      p_secret: 'not-a-real-token',
    });
    expect(error).not.toBeNull();
  });

  it('refuses an expired claim', async () => {
    const manager = await newUser('mp-expired-mgr');
    const profileId = await createManagedProfile(manager, { full_name: 'Expired' });
    const claim = await createClaim(manager, profileId, { expiresAt: '2020-01-01T00:00:00Z' });
    const claimant = await newUser('mp-expired');

    const { error } = await claimant.client.rpc('preview_profile_claim', { p_secret: claim.token });
    expect(error).not.toBeNull();
  });

  it('never lets the claimant read the claim row itself', async () => {
    const manager = await newUser('mp-opaque-mgr');
    const profileId = await createManagedProfile(manager, { full_name: 'Opaque' });
    await createClaim(manager, profileId);
    const claimant = await newUser('mp-opaque');

    const { data } = await claimant.client.from('profile_claims').select('token_hash');
    expect(data).toEqual([]);
  });
});

describe('the handover', () => {
  it("does not move anything on the claimant's word alone", async () => {
    const manager = await newUser('mp-halfway-mgr');
    const profileId = await createManagedProfile(manager, { full_name: 'Half Way' });
    const claim = await createClaim(manager, profileId);
    const claimant = await newUser('mp-halfway');

    const { error } = await claimant.client.rpc('accept_profile_claim', { p_secret: claim.token });
    expect(error).toBeNull();

    // Still the manager's, and still unreachable by the person who claimed it.
    const { data: stillManaged } = await manager.client
      .from('profiles')
      .select('user_id,managed_by')
      .eq('id', profileId)
      .single();
    expect(stillManaged!.user_id).toBeNull();
    expect(stillManaged!.managed_by).toBe(manager.id);

    const { data: notYet } = await claimant.client.from('profiles').select('id').eq('id', profileId);
    expect(notYet).toEqual([]);
  });

  it('transfers the profile and its records once the manager confirms', async () => {
    const manager = await newUser('mp-transfer-mgr');
    const profileId = await createManagedProfile(manager, { full_name: 'Amma' });
    await manager.client
      .from('vitals')
      .insert(insertPayload('vitals', { id: manager.id, profileId }));
    const claim = await createClaim(manager, profileId);
    const claimant = await newUser('mp-transfer');

    await claimant.client.rpc('accept_profile_claim', { p_secret: claim.token });
    const { error } = await manager.client.rpc('complete_profile_claim', { p_claim: claim.id });
    expect(error).toBeNull();

    const { data: now } = await claimant.client
      .from('profiles')
      .select('id,user_id,managed_by')
      .eq('id', profileId)
      .single();
    expect(now!.user_id).toBe(claimant.id);
    expect(now!.managed_by).toBeNull();

    const { data: records } = await claimant.client
      .from('vitals')
      .select('id')
      .eq('profile_id', profileId);
    expect(records).toHaveLength(1);
  });

  it('leaves the former manager with caregiver access, not manager', async () => {
    const manager = await newUser('mp-downgrade-mgr');
    const profileId = await createManagedProfile(manager, { full_name: 'Downgrade' });
    const claim = await createClaim(manager, profileId);
    const claimant = await newUser('mp-downgrade');

    await claimant.client.rpc('accept_profile_claim', { p_secret: claim.token });
    await manager.client.rpc('complete_profile_claim', { p_claim: claim.id });

    const { data: membership } = await manager.client
      .from('circle_memberships')
      .select('role,status')
      .eq('owner_id', profileId)
      .eq('member_id', manager.id)
      .single();
    expect(membership!.role).toBe('caregiver');
    expect(membership!.status).toBe('active');

    // A caregiver can add, but deleting belongs to the owner alone now.
    const { data: added } = await manager.client
      .from('vitals')
      .insert(insertPayload('vitals', { id: manager.id, profileId }))
      .select('id')
      .single();
    expect(added).not.toBeNull();

    const { data: deleted } = await manager.client
      .from('vitals')
      .delete()
      .eq('id', added!.id)
      .select('id');
    expect(deleted).toEqual([]);
  });

  it('keeps the history, attributed to whoever actually acted', async () => {
    const manager = await newUser('mp-history-mgr');
    const profileId = await createManagedProfile(manager, { full_name: 'History' });
    const inserted = await manager.client
      .from('vitals')
      .insert(insertPayload('vitals', { id: manager.id, profileId }))
      .select('id')
      .single();
    // What the app logs after a write into a profile that is not its own.
    await manager.client.rpc('log_audit_event', {
      p_owner: profileId,
      p_action: 'added',
      p_resource_type: 'vitals',
      p_resource_id: inserted.data!.id,
    });

    const claim = await createClaim(manager, profileId);
    const claimant = await newUser('mp-history');
    await claimant.client.rpc('accept_profile_claim', { p_secret: claim.token });
    await manager.client.rpc('complete_profile_claim', { p_claim: claim.id });

    const { data: feed, error } = await claimant.client.rpc('list_audit_feed', { p_limit: 30 });
    expect(error).toBeNull();
    const entries = feed as { action: string; actor_id: string }[];
    expect(entries.map((entry) => entry.action)).toContain('added');
    expect(entries.map((entry) => entry.action)).toContain('handed_over_profile');
    // Everything in the new owner's feed was done by the person who did it.
    for (const entry of entries) {
      expect(entry.actor_id).toBe(manager.id);
    }
  });

  it('refuses to hand over to an account that already has its own records', async () => {
    const manager = await newUser('mp-conflict-mgr');
    const profileId = await createManagedProfile(manager, { full_name: 'Conflict' });
    const claim = await createClaim(manager, profileId);
    const busy = await newUser('mp-busy');
    await busy.client.from('vitals').insert(insertPayload('vitals', busy));

    const { error } = await busy.client.rpc('accept_profile_claim', { p_secret: claim.token });
    expect(error).not.toBeNull();
    expect(error!.message).toContain('own health records');
  });

  it('cannot be completed by anyone but the manager', async () => {
    const manager = await newUser('mp-guard-mgr');
    const profileId = await createManagedProfile(manager, { full_name: 'Not Yours' });
    const claim = await createClaim(manager, profileId);
    const claimant = await newUser('mp-not-manager');
    await claimant.client.rpc('accept_profile_claim', { p_secret: claim.token });

    const { error: byClaimant } = await claimant.client.rpc('complete_profile_claim', {
      p_claim: claim.id,
    });
    expect(byClaimant).not.toBeNull();

    const { error: byStranger } = await stranger.client.rpc('complete_profile_claim', {
      p_claim: claim.id,
    });
    expect(byStranger).not.toBeNull();

    const { data: untouched } = await manager.client
      .from('profiles')
      .select('managed_by')
      .eq('id', profileId)
      .single();
    expect(untouched!.managed_by).toBe(manager.id);
  });

  it('cannot be completed before anyone has claimed it', async () => {
    const manager = await newUser('mp-unclaimed-mgr');
    const profileId = await createManagedProfile(manager, { full_name: 'Unclaimed' });
    const claim = await createClaim(manager, profileId);

    const { error } = await manager.client.rpc('complete_profile_claim', { p_claim: claim.id });
    expect(error).not.toBeNull();
  });

  it('cannot be claimed twice by different people', async () => {
    const manager = await newUser('mp-contested-mgr');
    const profileId = await createManagedProfile(manager, { full_name: 'Contested' });
    const claim = await createClaim(manager, profileId);
    const first = await newUser('mp-first');
    const second = await newUser('mp-second');

    await first.client.rpc('accept_profile_claim', { p_secret: claim.token });
    const { error } = await second.client.rpc('accept_profile_claim', { p_secret: claim.token });
    expect(error).not.toBeNull();
  });

  it('is refusable by the manager, leaving the profile where it was', async () => {
    const manager = await newUser('mp-refused-mgr');
    const profileId = await createManagedProfile(manager, { full_name: 'Refused' });
    const claim = await createClaim(manager, profileId);
    const claimant = await newUser('mp-refused');
    await claimant.client.rpc('accept_profile_claim', { p_secret: claim.token });

    const { error } = await manager.client.rpc('reject_profile_claim', { p_claim: claim.id });
    expect(error).toBeNull();

    const { data: kept } = await manager.client
      .from('profiles')
      .select('managed_by')
      .eq('id', profileId)
      .single();
    expect(kept!.managed_by).toBe(manager.id);

    // A refused claim is spent: its secret no longer resolves.
    const { error: reused } = await claimant.client.rpc('accept_profile_claim', {
      p_secret: claim.token,
    });
    expect(reused).not.toBeNull();
  });

  it('is withdrawable while nobody has claimed it', async () => {
    const manager = await newUser('mp-withdraw-mgr');
    const profileId = await createManagedProfile(manager, { full_name: 'Withdrawn' });
    const claim = await createClaim(manager, profileId);

    const { error } = await manager.client.from('profile_claims').delete().eq('id', claim.id);
    expect(error).toBeNull();

    const claimant = await newUser('mp-withdrawn');
    const { error: gone } = await claimant.client.rpc('preview_profile_claim', {
      p_secret: claim.token,
    });
    expect(gone).not.toBeNull();
  });

  it('cannot be started by someone who does not manage the profile', async () => {
    const manager = await newUser('mp-guarded-mgr');
    const profileId = await createManagedProfile(manager, { full_name: 'Guarded' });

    const { error } = await stranger.client.from('profile_claims').insert({
      profile_id: profileId,
      manager_id: stranger.id,
      token_hash: 'a'.repeat(64),
      code_hash: 'b'.repeat(64),
    });
    expect(error).not.toBeNull();
  });
});
