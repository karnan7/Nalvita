import { render, waitFor } from '@testing-library/react-native';

import { TABS, TabsLayout } from '@/navigation/tabs-layout';

const mockReplace = jest.fn();
let mockSegments: string[] = [];
let mockAuth = { session: null as unknown, loading: false };

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSegments: () => mockSegments,
  Stack: Object.assign(
    ({ children }: { children?: unknown }) => children ?? null,
    { Screen: () => null },
  ),
  Tabs: Object.assign(
    ({ children }: { children?: unknown }) => children ?? null,
    { Screen: () => null },
  ),
}));

jest.mock('@nalvita/data', () => {
  const actual = jest.requireActual('@nalvita/data');
  return {
    ...actual,
    useAuth: () => mockAuth,
    useProfile: () => ({ isPending: false }),
  };
});

const mockStopRefresh = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: {} },
  watchAppStateForAuthRefresh: jest.fn(() => mockStopRefresh),
}));
jest.mock('@/lib/platform', () => ({
  mobilePlatform: {
    client: { auth: {} },
    appBaseUrl: 'https://nalvita.test',
    openUrl: jest.fn(),
  },
}));

// Imported after the mocks so they are picked up.
import { AuthGate, RootLayout } from '@/navigation/root-layout';
import { watchAppStateForAuthRefresh } from '@/lib/supabase';

const SESSION = { user: { id: '00000000-0000-4000-8000-000000000001' } };

beforeEach(() => {
  jest.clearAllMocks();
  mockSegments = [];
  mockAuth = { session: null, loading: false };
});

/**
 * Redirects rather than conditional rendering, because expo-router owns the URL
 * and a deep link lands on a route before the gate runs.
 */
describe('AuthGate', () => {
  it('sends a signed-out person to login', async () => {
    render(<AuthGate />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
  });

  it('leaves them alone once they are already on login', async () => {
    mockSegments = ['login'];

    render(<AuthGate />);

    await waitFor(() => expect(mockReplace).not.toHaveBeenCalled());
  });

  it('moves a signed-in person off the login screen', async () => {
    mockAuth = { session: SESSION, loading: false };
    mockSegments = ['login'];

    render(<AuthGate />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('does not move a signed-in person who is already inside the app', async () => {
    mockAuth = { session: SESSION, loading: false };
    mockSegments = ['(tabs)'];

    render(<AuthGate />);

    await waitFor(() => expect(mockReplace).not.toHaveBeenCalled());
  });

  /** Redirecting mid-lookup would bounce someone out of a deep link. */
  it('waits for the session lookup before deciding anything', async () => {
    mockAuth = { session: null, loading: true };

    render(<AuthGate />);

    await waitFor(() => expect(mockReplace).not.toHaveBeenCalled());
  });
});

describe('RootLayout', () => {
  it('ties token refresh to app lifecycle, and lets go on unmount', async () => {
    const { unmount } = render(<RootLayout />);

    await waitFor(() => expect(watchAppStateForAuthRefresh).toHaveBeenCalled());

    unmount();

    // The listener must be torn down, or a signed-out app keeps refreshing.
    expect(mockStopRefresh).toHaveBeenCalled();
  });
});

describe('tab bar', () => {
  it('offers the app’s five destinations', () => {
    expect(TABS.map((tab) => tab.name)).toEqual([
      'index',
      'documents',
      'medicines',
      'vitals',
      'profile',
    ]);
  });

  it('gives every tab its own title and icon', () => {
    expect(new Set(TABS.map((t) => t.title)).size).toBe(TABS.length);
    expect(new Set(TABS.map((t) => t.icon)).size).toBe(TABS.length);
  });

  it('renders without a real navigator', () => {
    expect(() => render(<TabsLayout />)).not.toThrow();
  });
});
