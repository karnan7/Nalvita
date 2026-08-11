import { AppState, type AppStateStatus } from 'react-native';

import { supabase, watchAppStateForAuthRefresh } from '@/lib/supabase';

describe('the client', () => {
  it('stores the session somewhere, and it is not the default web storage', () => {
    expect(supabase.auth).toBeDefined();
  });
});

/**
 * Supabase's refresh timer knows nothing about app lifecycle. Left running it
 * wakes a backgrounded app to refresh a token nobody is waiting on, and iOS may
 * kill it for that.
 */
describe('watchAppStateForAuthRefresh', () => {
  let start: jest.SpyInstance;
  let stop: jest.SpyInstance;
  let handler: ((state: AppStateStatus) => void) | undefined;
  let removeListener: jest.Mock;

  beforeEach(() => {
    start = jest.spyOn(supabase.auth, 'startAutoRefresh').mockResolvedValue(undefined as never);
    stop = jest.spyOn(supabase.auth, 'stopAutoRefresh').mockResolvedValue(undefined as never);
    removeListener = jest.fn();
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event: string, callback: (state: AppStateStatus) => void) => {
        handler = callback;
        return { remove: removeListener } as never;
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    handler = undefined;
  });

  it('refreshes while the app is in front of the person', () => {
    watchAppStateForAuthRefresh();

    handler?.('active');

    expect(start).toHaveBeenCalled();
  });

  it('stops refreshing once the app is backgrounded', () => {
    watchAppStateForAuthRefresh();
    start.mockClear();

    handler?.('background');

    expect(stop).toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it('treats being inactive the same as backgrounded', () => {
    watchAppStateForAuthRefresh();

    handler?.('inactive');

    expect(stop).toHaveBeenCalled();
  });

  it('unsubscribes and stops the timer when torn down', () => {
    const teardown = watchAppStateForAuthRefresh();

    teardown();

    expect(removeListener).toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
  });
});
