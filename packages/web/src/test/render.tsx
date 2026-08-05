import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { ActiveProfileProvider } from '@/components/active-profile-provider';
import { AuthProvider } from '@/components/auth-provider';
import { ThemeProvider } from '@/lib/theme';

/** Renders with the same provider stack as main.tsx, minus BrowserRouter. */
export function renderWithProviders(ui: ReactNode, { route = '/' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <ActiveProfileProvider>{ui}</ActiveProfileProvider>
          </QueryClientProvider>
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}
