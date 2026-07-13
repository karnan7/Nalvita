import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseTestConfig } from '../setup/supabase-config.js';

const config = getSupabaseTestConfig();

/**
 * service_role client — setup/teardown and structural queries only.
 * Assertions about app behavior always go through per-user clients,
 * which hit the same PostgREST + RLS path the web app uses.
 */
export const admin = createClient(config.url, config.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const supabaseUrl = config.url;
export const supabaseAnonKey = config.anonKey;

const TEST_PASSWORD = 'integration-test-password';

export interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

let userCounter = 0;

/** Creates a confirmed auth user and returns a signed-in anon-key client for them. */
export async function createTestUser(label: string): Promise<TestUser> {
  const email = `${label}-${Date.now()}-${userCounter++}@integration.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Failed to create test user: ${error?.message ?? 'no user returned'}`);
  }

  const client = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (signInError) {
    throw new Error(`Failed to sign in test user: ${signInError.message}`);
  }

  return { id: data.user.id, email, client };
}

/** Deletes test users; row cleanup happens via ON DELETE CASCADE. */
export async function deleteTestUsers(...users: TestUser[]): Promise<void> {
  for (const user of users) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      throw new Error(`Failed to delete test user ${user.id}: ${error.message}`);
    }
  }
}
