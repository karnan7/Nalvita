import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from '@/components/app-layout';
import { RequireAuth } from '@/components/require-auth';
import DashboardPage from '@/pages/dashboard';
import DocumentsPage from '@/pages/documents';
import LoginPage from '@/pages/login';
import MedicinesPage from '@/pages/medicines';
import OnboardingPage from '@/pages/onboarding';
import SettingsPage from '@/pages/settings';
import VitalsPage from '@/pages/vitals';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/medicines" element={<MedicinesPage />} />
          <Route path="/vitals" element={<VitalsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
