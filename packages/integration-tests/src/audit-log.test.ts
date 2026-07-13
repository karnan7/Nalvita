import { auditLogSchema } from '@nalvita/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestUser, deleteTestUsers, type TestUser } from './helpers/clients.js';
import { createActiveMembership } from './helpers/memberships.js';

/**
 * audit_log invariants: append-only for everyone (including the owner),
 * entries always written as oneself, only about owners whose data the
 * actor can at least view, and readable by the owner alone.
 */

let owner: TestUser;
let member: TestUser; // active viewer on {all}
let vitalsMember: TestUser; // active viewer on {vitals} only
let stranger: TestUser;

beforeAll(async () => {
  owner = await createTestUser('audit-owner');
  member = await createTestUser('audit-member');
  vitalsMember = await createTestUser('audit-vitals-member');
  stranger = await createTestUser('audit-stranger');

  await createActiveMembership(owner, member, 'viewer', ['all']);
  await createActiveMembership(owner, vitalsMember, 'viewer', ['vitals']);
});

afterAll(async () => {
  await deleteTestUsers(owner, member, vitalsMember, stranger);
});

describe('appending', () => {
  it('owner can append about themselves', async () => {
    const { data, error } = await owner.client
      .from('audit_log')
      .insert({
        actor_id: owner.id,
        owner_id: owner.id,
        action: 'added_vital',
        resource_type: 'vitals',
      })
      .select()
      .single();
    expect(error).toBeNull();
    expect(auditLogSchema.parse(data).actor_id).toBe(owner.id);
  });

  it('circle member can append about the owner', async () => {
    const { error } = await member.client.from('audit_log').insert({
      actor_id: member.id,
      owner_id: owner.id,
      action: 'viewed_document',
      resource_type: 'documents',
    });
    expect(error).toBeNull();
  });

  it('entries cannot be written as another actor', async () => {
    const { error } = await owner.client.from('audit_log').insert({
      actor_id: member.id, // spoofed
      owner_id: owner.id,
      action: 'added_vital',
      resource_type: 'vitals',
    });
    expect(error?.code).toBe('42501');
  });

  it('a stranger cannot append about an owner', async () => {
    const { error } = await stranger.client.from('audit_log').insert({
      actor_id: stranger.id,
      owner_id: owner.id,
      action: 'viewed_document',
      resource_type: 'documents',
    });
    expect(error?.code).toBe('42501');
  });

  it('a member can only log against categories they can view', async () => {
    const { error: ok } = await vitalsMember.client.from('audit_log').insert({
      actor_id: vitalsMember.id,
      owner_id: owner.id,
      action: 'viewed_vital',
      resource_type: 'vitals',
    });
    expect(ok).toBeNull();

    const { error: denied } = await vitalsMember.client.from('audit_log').insert({
      actor_id: vitalsMember.id,
      owner_id: owner.id,
      action: 'viewed_document',
      resource_type: 'documents',
    });
    expect(denied?.code).toBe('42501');
  });
});

describe('reading', () => {
  it('the owner sees their audit trail', async () => {
    const { data, error } = await owner.client
      .from('audit_log')
      .select('*')
      .eq('owner_id', owner.id);
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(3);
  });

  it('members cannot read the trail, even about entries they wrote', async () => {
    const { data, error } = await member.client
      .from('audit_log')
      .select('id')
      .eq('owner_id', owner.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});

describe('append-only', () => {
  it('nobody can update entries — not even the owner', async () => {
    const { error } = await owner.client
      .from('audit_log')
      .update({ action: 'tampered' })
      .eq('owner_id', owner.id);
    expect(error?.code).toBe('42501');
  });

  it('nobody can delete entries — not even the owner', async () => {
    const { error } = await owner.client.from('audit_log').delete().eq('owner_id', owner.id);
    expect(error?.code).toBe('42501');
  });
});
