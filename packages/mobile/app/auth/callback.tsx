import { Redirect } from 'expo-router';

/**
 * Where the Google OAuth sheet returns to.
 *
 * `openAuthSessionAsync` normally hands the URL straight back to the code that
 * opened it, so this route rarely renders. It exists for the cold-open case —
 * the sheet completing after the app was killed — where the deep link would
 * otherwise land on an unmatched route. The session is already stored by then,
 * so the only job here is to get out of the way.
 */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
