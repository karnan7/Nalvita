import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface SupabaseTestConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

/**
 * Hard safety rail: this suite holds the service_role key and runs
 * destructive setup/teardown, so it must never talk to anything but a
 * local `supabase start` stack — least of all the cloud project.
 */
export function assertLocalhost(url: string): void {
  const host = new URL(url).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run integration tests against non-local Supabase host "${host}". ` +
        'This suite uses the service_role key and may wipe data; point it only at ' +
        'a local `supabase start` stack.',
    );
  }
}

function readStatusJson(): Record<string, string> {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
  let raw: string;
  try {
    raw = execSync('supabase status -o json', { cwd: repoRoot, encoding: 'utf8' });
  } catch {
    raw = execSync('npx supabase status -o json', { cwd: repoRoot, encoding: 'utf8' });
  }
  // The CLI sometimes prefixes the JSON with notices (e.g. stopped services).
  const jsonStart = raw.indexOf('{');
  if (jsonStart === -1) {
    throw new Error('Could not parse `supabase status -o json` output. Is `supabase start` running?');
  }
  return JSON.parse(raw.slice(jsonStart)) as Record<string, string>;
}

let cached: SupabaseTestConfig | undefined;

/**
 * Resolves the local stack's URL and keys, preferring SUPABASE_URL /
 * SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY env vars and falling back
 * to `supabase status`. The localhost guard applies to both sources.
 */
export function getSupabaseTestConfig(): SupabaseTestConfig {
  if (cached) return cached;

  let url = process.env.SUPABASE_URL;
  let anonKey = process.env.SUPABASE_ANON_KEY;
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    const status = readStatusJson();
    url = status.API_URL;
    anonKey = status.ANON_KEY;
    serviceRoleKey = status.SERVICE_ROLE_KEY;
  }

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase URL or keys. Run `supabase start`, or set SUPABASE_URL, ' +
        'SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  assertLocalhost(url);
  cached = { url, anonKey, serviceRoleKey };
  return cached;
}
