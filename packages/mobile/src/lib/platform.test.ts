import * as WebBrowser from 'expo-web-browser';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => ({})) }));

import { mobilePlatform } from '@/lib/platform';

describe('mobilePlatform', () => {
  it('carries the Supabase client the data hooks will use', () => {
    expect(mobilePlatform.client).toBeDefined();
    expect(mobilePlatform.client.auth).toBeDefined();
  });

  /**
   * Invite and handover links have to open somewhere a person without the app
   * installed can still reach, so this is the web origin — never `nalvita://`.
   */
  it('points links at the web app, not the app scheme', () => {
    expect(mobilePlatform.appBaseUrl).toMatch(/^https:\/\//);
    expect(mobilePlatform.appBaseUrl).not.toMatch(/^nalvita:/);
  });

  /**
   * An in-app browser rather than a hand-off: a signed document URL is a
   * credential, and this keeps it out of another app's history and tab list.
   */
  it('opens documents in an in-app browser', () => {
    mobilePlatform.openUrl('https://storage.test/signed');

    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://storage.test/signed');
  });
});
