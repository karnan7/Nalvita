import type { NalvitaPlatform } from '@nalvita/data';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

/**
 * The deployed web app. Invite and handover links have to point somewhere a
 * person without the app installed can still open, so this is the web origin
 * rather than the `nalvita://` scheme.
 */
const appBaseUrl = process.env.EXPO_PUBLIC_APP_BASE_URL ?? 'https://nalvita.app';

/** What React Native supplies to `@nalvita/data`. */
export const mobilePlatform: NalvitaPlatform = {
  client: supabase,
  appBaseUrl,
  // An in-app browser rather than handing off to Safari/Chrome: a signed
  // document URL is a credential, and this keeps it out of another app's
  // history and tab list. It is short-lived either way.
  openUrl: (url) => {
    void WebBrowser.openBrowserAsync(url);
  },
};
