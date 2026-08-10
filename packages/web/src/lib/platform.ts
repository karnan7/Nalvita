import type { NalvitaPlatform } from '@nalvita/data';

import { supabase } from '@/lib/supabase';

/**
 * What the browser supplies to `@nalvita/data`.
 *
 * The data hooks are shared with the React Native app, so they never reach for
 * `window` themselves — everything browser-shaped is gathered here instead.
 */
export const webPlatform: NalvitaPlatform = {
  client: supabase,
  appBaseUrl: window.location.origin,
  // `noopener` matters: a signed document URL must not hand the opened tab a
  // handle back to the app.
  openUrl: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
};
