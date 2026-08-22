import { AuthProvider, NalvitaDataProvider } from '@nalvita/data';
import type { SupabaseClient } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerPushToken, unregisterPushToken, usePushRegistration } from '@/lib/push';

/**
 * Making this phone reachable (KAR-52).
 *
 * The behaviour worth pinning down is mostly about *not* doing things: not
 * nagging someone who said no, not breaking sign-in when push is unavailable,
 * and not leaving a token behind on a phone somebody has handed back.
 */

const TOKEN = 'ExponentPushToken[test-device]';

interface Harness {
  rpc: jest.Mock;
  del: jest.Mock;
  eq: jest.Mock;
  client: SupabaseClient;
}

function makeHarness({ rpcError = null }: { rpcError?: unknown } = {}): Harness {
  const rpc = jest.fn(async () => ({ data: null, error: rpcError }));
  const eq = jest.fn(async () => ({ data: null, error: null }));
  const del = jest.fn(() => ({ eq }));

  const client = {
    rpc,
    from: jest.fn(() => ({ delete: del })),
  } as unknown as SupabaseClient;

  return { rpc, del, eq, client };
}

beforeEach(() => {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
    granted: true,
    canAskAgain: true,
  } as never);
  jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({
    granted: true,
    canAskAgain: true,
  } as never);
  jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({ data: TOKEN } as never);
  Object.defineProperty(Device, 'isDevice', { value: true, configurable: true });
  Platform.OS = 'android';
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('registering a device', () => {
  it('claims the token for the signed-in account through the RPC', async () => {
    const harness = makeHarness();

    const result = await registerPushToken(harness.client);

    expect(result).toBe(TOKEN);
    expect(harness.rpc).toHaveBeenCalledWith('register_push_token', {
      p_token: TOKEN,
      p_platform: 'android',
      p_device_label: 'Pixel 7',
    });
  });

  /**
   * A plain insert cannot move a token off the previous account — RLS gates
   * both UPDATE and DELETE on owning the row already. Going through the RPC is
   * the whole reason a handed-on phone works at all.
   */
  it('does not try to write the table directly', async () => {
    const harness = makeHarness();

    await registerPushToken(harness.client);

    expect(harness.client.from).not.toHaveBeenCalled();
  });

  it('sends the model name, never the name its owner gave the phone', async () => {
    const harness = makeHarness();

    await registerPushToken(harness.client);

    const [, args] = harness.rpc.mock.calls[0];
    expect(args.p_device_label).toBe('Pixel 7');
  });
});

describe('when the device cannot receive notifications', () => {
  it('does nothing on a simulator, which has no push service', async () => {
    Object.defineProperty(Device, 'isDevice', { value: false, configurable: true });
    const harness = makeHarness();

    expect(await registerPushToken(harness.client)).toBeNull();
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it('accepts a refusal rather than registering anyway', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: false,
      canAskAgain: true,
    } as never);
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({
      granted: false,
      canAskAgain: true,
    } as never);
    const harness = makeHarness();

    expect(await registerPushToken(harness.client)).toBeNull();
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  /**
   * Asking again after an explicit refusal is what drives people to switch
   * notifications off at the OS level, which is far harder to undo than a
   * setting inside the app.
   */
  it('does not re-prompt somebody who has already said no', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: false,
      canAskAgain: false,
    } as never);
    const harness = makeHarness();

    await registerPushToken(harness.client);

    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('asks once when permission has never been decided', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: false,
      canAskAgain: true,
    } as never);
    const harness = makeHarness();

    await registerPushToken(harness.client);

    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('gives up quietly when Expo cannot issue a token', async () => {
    jest.mocked(Notifications.getExpoPushTokenAsync).mockRejectedValue(new Error('offline'));
    const harness = makeHarness();

    expect(await registerPushToken(harness.client)).toBeNull();
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  /**
   * Push is an addition to Nalvita, not a precondition. A registration failure
   * must never be able to take sign-in down with it.
   */
  it('reports failure rather than throwing when the write is rejected', async () => {
    const harness = makeHarness({ rpcError: { message: 'denied' } });

    await expect(registerPushToken(harness.client)).resolves.toBeNull();
  });
});

describe('signing out', () => {
  it('detaches the device so its notifications stop', async () => {
    const harness = makeHarness();

    await unregisterPushToken(harness.client);

    expect(harness.client.from).toHaveBeenCalledWith('push_tokens');
    expect(harness.eq).toHaveBeenCalledWith('token', TOKEN);
  });

  it('does not prompt for notifications on the way out', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: false,
      canAskAgain: true,
    } as never);
    const harness = makeHarness();

    await unregisterPushToken(harness.client);

    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(harness.client.from).not.toHaveBeenCalled();
  });

  /**
   * Signing out with no signal leaves the row behind. That is untidy rather
   * than unsafe — the send path prunes it once Expo reports the installation
   * gone — but it must not stop the sign-out itself.
   */
  it('does not throw when the token cannot be looked up', async () => {
    jest.mocked(Notifications.getExpoPushTokenAsync).mockRejectedValue(new Error('offline'));
    const harness = makeHarness();

    await expect(unregisterPushToken(harness.client)).resolves.toBeUndefined();
  });
});

describe('staying registered while signed in', () => {
  function Probe() {
    usePushRegistration();
    return null;
  }

  function mount(harness: Harness, signedIn: boolean) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const session = signedIn
      ? { user: { id: 'user-1', email: 'test@example.com' }, access_token: 't' }
      : null;

    const client = {
      ...harness.client,
      auth: {
        getSession: jest.fn(async () => ({ data: { session }, error: null })),
        onAuthStateChange: jest.fn(() => ({
          data: { subscription: { unsubscribe: jest.fn() } },
        })),
      },
    } as unknown as SupabaseClient;

    return render(
      <NalvitaDataProvider client={client} appBaseUrl="https://nalvita.test" openUrl={jest.fn()}>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <Probe />
          </QueryClientProvider>
        </AuthProvider>
      </NalvitaDataProvider>,
    );
  }

  it('registers the device once a session exists', async () => {
    const harness = makeHarness();

    mount(harness, true);

    await waitFor(() => {
      expect(harness.rpc).toHaveBeenCalledWith('register_push_token', expect.anything());
    });
  });

  /**
   * Registering while signed out would have no account to attach the token to,
   * and the RPC would reject it — so the guard is here, not only in the SQL.
   */
  it('does nothing while nobody is signed in', async () => {
    const harness = makeHarness();

    mount(harness, false);
    await act(async () => {
      await Promise.resolve();
    });

    expect(harness.rpc).not.toHaveBeenCalled();
  });
});

describe('platforms with no Expo token to get', () => {
  /**
   * 'web' exists in the enum for the browser client, which registers a VAPID
   * subscription instead. React Native Web reaching this code would otherwise
   * store a token Expo never issued.
   */
  it('does not register on web, which uses a different mechanism entirely', async () => {
    Platform.OS = 'web';
    const harness = makeHarness();

    expect(await registerPushToken(harness.client)).toBeNull();
    expect(harness.rpc).not.toHaveBeenCalled();
  });
});
