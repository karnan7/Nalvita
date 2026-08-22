import type { PushPlatform } from '@nalvita/core';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Registering this phone to receive notifications (KAR-52).
 *
 * The token identifies an app *installation*, not a person, which is the fact
 * that shapes everything here: it survives sign-out, so registering has to be
 * able to take a token away from whoever held it last. That move needs
 * privileges RLS will not grant a user over someone else's row, so it happens
 * through the `register_push_token` RPC rather than a plain insert.
 *
 * Nothing in this file decides *what* a notification says. It only makes the
 * device reachable.
 */

/** Permission is asked for once; being turned down is an answer, not a retry. */
async function ensurePermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;

  // Asking again after an explicit refusal is what makes people disable
  // notifications at the OS level, which is far harder to undo.
  if (!existing.canAskAgain) return false;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** Which platform bucket this device belongs to, in the DB's vocabulary. */
function currentPlatform(): PushPlatform | null {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  // 'web' exists in the enum for the browser client, which registers a VAPID
  // subscription rather than an Expo token. React Native Web is not that.
  return null;
}

/**
 * What to show in a device list.
 *
 * `modelName` ('Pixel 7'), deliberately, not `deviceName` — the latter is the
 * name the owner gave the phone, which is routinely "Asha's iPhone". A person's
 * name has no business in a row that exists to route a notification.
 */
function deviceLabel(): string | null {
  return Device.modelName ?? null;
}

/** The EAS project the token is scoped to; without it Expo cannot issue one. */
function projectId(): string | undefined {
  const easConfig = Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined;
  return easConfig?.projectId;
}

/**
 * Registers this device for the signed-in account, returning the token.
 *
 * Returns null whenever the device cannot receive notifications at all — a
 * simulator, a refused permission, a missing EAS project. All of those are
 * ordinary states rather than errors: the app works fine without push, and a
 * thrown exception here would break sign-in for anyone who said no.
 */
export async function registerPushToken(supabase: SupabaseClient): Promise<string | null> {
  // Simulators have no push service to register with. Expo throws rather than
  // returning empty, so this is a guard, not an optimisation.
  if (!Device.isDevice) return null;

  const platform = currentPlatform();
  if (!platform) return null;

  const id = projectId();
  if (!id) return null;

  if (!(await ensurePermission())) return null;

  let token: string;
  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId: id });
    token = result.data;
  } catch {
    // No network, or Expo declined to issue one. Nothing to record.
    return null;
  }

  const { error } = await supabase.rpc('register_push_token', {
    p_token: token,
    p_platform: platform,
    p_device_label: deviceLabel(),
  });

  return error ? null : token;
}

/**
 * Detaches this device from the account that is signing out.
 *
 * Must run *before* `signOut()`: the delete goes through RLS, which needs the
 * session that is about to be thrown away. Afterwards there is no `auth.uid()`
 * and the row would simply stay, sending the next person's notifications — or
 * rather, this person's notifications — to a phone they have handed back.
 */
export async function unregisterPushToken(supabase: SupabaseClient): Promise<void> {
  if (!Device.isDevice) return;

  const id = projectId();
  if (!id) return;

  // Only ask Expo for the token if permission already exists; prompting
  // somebody for notifications as they log out would be absurd.
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await supabase.from('push_tokens').delete().eq('token', token);
  } catch {
    // Offline sign-out: the row outlives the session. The send path prunes it
    // when Expo reports the installation gone, so this is untidy, not unsafe.
  }
}
