import { getSupabaseTestConfig } from './supabase-config.js';

/** Fails fast with a clear message when the local stack isn't up. */
export default async function globalSetup(): Promise<void> {
  const config = getSupabaseTestConfig();
  try {
    const res = await fetch(`${config.url}/rest/v1/`, { headers: { apikey: config.anonKey } });
    if (!res.ok) {
      throw new Error(`PostgREST responded with ${res.status}`);
    }
  } catch (cause) {
    throw new Error(
      `Local Supabase is not reachable at ${config.url}. Run \`supabase start\` first.`,
      { cause },
    );
  }
}
