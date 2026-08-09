import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from '@/components/app-layout';
import { RequireAuth } from '@/components/require-auth';
import ClaimProfilePage from '@/pages/claim-profile';
import DashboardPage from '@/pages/dashboard';
import DocumentsPage from '@/pages/documents';
import FamilyPage from '@/pages/family';
import FamilySharingPage from '@/pages/family-sharing';
import JoinInvitePage from '@/pages/join-invite';
import LandingPage from '@/pages/landing';
import LoginPage from '@/pages/login';
import MedicinesPage from '@/pages/medicines';
import OnboardingPage from '@/pages/onboarding';
import ProfilePage from '@/pages/profile';
import SettingsPage from '@/pages/settings';
import TimelinePage from '@/pages/timeline';
import VitalsPage from '@/pages/vitals';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/family/join" element={<JoinInvitePage />} />
      <Route path="/profile/claim" element={<ClaimProfilePage />} />
      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/medicines" element={<MedicinesPage />} />
          <Route path="/vitals" element={<VitalsPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/family" element={<FamilyPage />} />
          <Route path="/family/sharing" element={<FamilySharingPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
