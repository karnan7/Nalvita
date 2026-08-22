import type { SupabaseClient } from '@supabase/supabase-js';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerPushToken, unregisterPushToken } from '@/lib/push';

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
