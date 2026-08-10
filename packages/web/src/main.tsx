import { AuthProvider, NalvitaDataProvider } from '@nalvita/data';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { ActiveProfileProvider } from './components/active-profile-provider';
import { webPlatform } from './lib/platform';
import { ThemeProvider } from './lib/theme';
import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <NalvitaDataProvider {...webPlatform}>
          <AuthProvider>
            <QueryClientProvider client={queryClient}>
              <ActiveProfileProvider>
                <App />
              </ActiveProfileProvider>
            </QueryClientProvider>
          </AuthProvider>
        </NalvitaDataProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
