/**
 * The environment this app reads at build time.
 *
 * Expo inlines anything prefixed `EXPO_PUBLIC_` into the bundle, so these are
 * public by definition — the Supabase anon key is meant to be (row-level
 * security is the authorization layer, not the key). Never add a secret here.
 *
 * Declared by hand rather than relying on Expo's generated `expo-env.d.ts`,
 * which is gitignored and so absent on a clean checkout and in CI.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    /** Supabase project URL, e.g. `https://xxxx.supabase.co`. */
    EXPO_PUBLIC_SUPABASE_URL?: string;
    /** Supabase anon key — public by design. */
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    /** Origin of the deployed web app, used to build invite and handover links. */
    EXPO_PUBLIC_APP_BASE_URL?: string;
  }
}

declare const process: { env: NodeJS.ProcessEnv };
