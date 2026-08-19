import { NalvitaDataProvider, AuthProvider, useActiveProfile } from '@nalvita/data';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ActiveProfileProvider } from '@/lib/active-profile';
import { makeHarness, PROFILE_ID, USER_ID, type Harness } from '@/test/render';

/**
 * Whose records the app loads.
 *
 * The one failure mode a health app cannot have is showing the wrong person's
 * allergies, so the two things worth pinning down are that the id comes from
 * the profile row rather than the account, and that it is empty — not guessed —
 * until that row has actually arrived.
 */

/** A PostgREST-shaped link that never settles — a request still in flight. */
function pendingChain() {
  const link = new Promise(() => undefined) as Promise<never> & Record<string, unknown>;
  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'is', 'order', 'limit']) {
    link[method] = () => link;
  }
  link.single = () => link;
  link.maybeSingle = () => link;
  return link;
}

function Probe() {
  const { profileId, isSelf } = useActiveProfile();
  return <Text>{`profile:[${profileId}] self:${isSelf}`}</Text>;
}

function value() {
  return screen.getByText(/^profile:/).props.children as string;
}

function mount(harness: Harness) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <NalvitaDataProvider
      client={harness.client}
      appBaseUrl="https://nalvita.test"
      openUrl={harness.openUrl}
    >
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <ActiveProfileProvider>
            <Probe />
          </ActiveProfileProvider>
        </QueryClientProvider>
      </AuthProvider>
    </NalvitaDataProvider>,
  );
}

describe('whose records are loaded', () => {
  it('scopes to the profile row, not the account behind it', async () => {
    const harness = makeHarness({ signedIn: true });

    mount(harness);

    await waitFor(() => {
      expect(value()).toContain(`profile:[${PROFILE_ID}]`);
    });
    // Records belong to profiles; the session only knows the account. Using the
    // user id here would load nothing, or worse, the wrong thing.
    expect(value()).not.toContain(USER_ID);
  });

  /**
   * Every hook in `@nalvita/data` stays disabled while `profileId` is empty, so
   * an empty string is what keeps a half-loaded app showing empty screens
   * rather than someone else's.
   */
  it('holds nothing until the profile row arrives', () => {
    const harness = makeHarness({ signedIn: true });
    // A request that never settles: the state every cold start passes through.
    harness.from.mockImplementation(() => pendingChain());

    mount(harness);

    expect(value()).toContain('profile:[]');
  });

  it('is empty while signed out, so no records load at all', async () => {
    // The stub would happily answer with a profile row; there is simply no
    // session to look one up with, which is the point.
    mount(makeHarness());

    await waitFor(() => {
      expect(value()).toContain('self:true');
    });
    expect(value()).toContain('profile:[]');
  });
});
