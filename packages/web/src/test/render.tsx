import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AuthProvider } from '@/components/auth-provider';

/** Renders with the same provider stack as main.tsx, minus BrowserRouter. */
export function renderWithProviders(ui: ReactNode, { route = '/' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}
