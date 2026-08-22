/**
 * A stand-in for Expo's push API, for tests only (KAR-52).
 *
 * The send function's most consequential branch is the one that *deletes* a
 * row: a `DeviceNotRegistered` ticket prunes the token, while an outage must
 * not. Proving that against the real Expo API would mean calling a third party
 * from CI and somehow persuading it to fail on demand, so the send function
 * takes its endpoint from `EXPO_PUSH_URL` and tests point it here.
 *
 * This is never deployed to the hosted project — see the deploy note in
 * `supabase/functions/README.md`. It holds no data and answers only what the
 * caller asks it to.
 *
 * The reply is chosen by the token itself, so a test controls the outcome by
 * choosing what to register:
 *   * a token containing 'dead'   → a DeviceNotRegistered error ticket
 *   * a token containing 'broken' → an error ticket that is *not* about the
 *     device being gone, which must leave the row alone
 *   * anything else               → ok
 */

interface ExpoMessage {
  to: string;
}

Deno.serve(async (req: Request) => {
  const messages = (await req.json()) as ExpoMessage[];

  const data = messages.map((message) => {
    if (message.to.includes('dead')) {
      return {
        status: 'error',
        message: 'The recipient device is not registered.',
        details: { error: 'DeviceNotRegistered' },
      };
    }
    if (message.to.includes('broken')) {
      return {
        status: 'error',
        message: 'Message rate exceeded.',
        details: { error: 'MessageRateExceeded' },
      };
    }
    return { status: 'ok', id: `ticket-${message.to}` };
  });

  return Response.json({ data });
});
