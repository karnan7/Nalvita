import { AuthProvider, NalvitaDataProvider } from '@nalvita/data';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { ActiveProfileProvider } from '@/components/active-profile-provider';
import { supabase } from '@/lib/supabase';
import { ThemeProvider } from '@/lib/theme';

/** Opening a URL is a side effect tests assert on, not something they perform. */
export const openUrl = vi.fn();

/** Renders with the same provider stack as main.tsx, minus BrowserRouter. */
export function renderWithProviders(ui: ReactNode, { route = '/' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[route]}>
        {/* `supabase` here is the module-boundary mock from test/setup.ts, so
            the data hooks talk to the same stub each test configures. */}
        <NalvitaDataProvider client={supabase} appBaseUrl="https://nalvita.test" openUrl={openUrl}>
          <AuthProvider>
            <QueryClientProvider client={queryClient}>
              <ActiveProfileProvider>{ui}</ActiveProfileProvider>
            </QueryClientProvider>
          </AuthProvider>
        </NalvitaDataProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}
