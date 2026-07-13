import type { CircleRole, ShareCategory } from '@nalvita/core';
import type { TestUser } from './clients.js';

/** Owner invites a member (row starts pending). Returns the membership id. */
export async function invite(
  owner: TestUser,
  member: TestUser,
  role: CircleRole,
  categories: ShareCategory[],
): Promise<string> {
  const { data, error } = await owner.client
    .from('circle_memberships')
    .insert({
      owner_id: owner.id,
      member_id: member.id,
      role,
      shared_categories: categories,
    })
    .select('id')
    .single();
  if (error) throw new Error(`Invite failed: ${error.message}`);
  return data.id as string;
}

/** Member accepts their pending invite. */
export async function accept(member: TestUser, membershipId: string): Promise<void> {
  const { data, error } = await member.client
    .from('circle_memberships')
    .update({ status: 'active' })
    .eq('id', membershipId)
    .select('status')
    .single();
  if (error) throw new Error(`Accept failed: ${error.message}`);
  if (data.status !== 'active') throw new Error('Accept did not activate the membership');
}

/** Invite + accept in one step, for tests that just need an active member. */
export async function createActiveMembership(
  owner: TestUser,
  member: TestUser,
  role: CircleRole,
  categories: ShareCategory[],
): Promise<string> {
  const id = await invite(owner, member, role, categories);
  await accept(member, id);
  return id;
}

/** Owner revokes a membership. */
export async function revoke(owner: TestUser, membershipId: string): Promise<void> {
  const { error } = await owner.client
    .from('circle_memberships')
    .update({ status: 'revoked' })
    .eq('id', membershipId);
  if (error) throw new Error(`Revoke failed: ${error.message}`);
}
