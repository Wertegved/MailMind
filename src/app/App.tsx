import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Dashboard } from '../features/dashboard/Dashboard';
import { Onboarding } from '../features/onboarding/Onboarding';
import { SegmentView } from '../features/inbox/SegmentView';
import { SettingsPage } from '../features/settings/SettingsPage';
import { UpcomingDatesPage } from '../features/dates/UpcomingDatesPage';
import { DesignPreview } from '../features/design/DesignPreview';
import { useMailMind } from '../state/MailMindProvider';
import { ClientShell } from '../components/layout/ClientShell';
import { ClientQueuePage } from '../features/client/ClientQueuePage';
import { ClientReviewPage } from '../features/client/ClientReviewPage';
import { NotFoundPage } from '../features/shared/NotFoundPage';

function EntryRedirect() {
  const { state } = useMailMind();
  return <Navigate to={state.connection.status === 'connected' ? '/app/dashboard' : '/onboarding'} replace />;
}

function OnboardingRoute() {
  const { state } = useMailMind();
  const [searchParams] = useSearchParams();
  const isSyncing = searchParams.get('step') === 'sync';
  return state.connection.status === 'connected' && !isSyncing
    ? <Navigate to="/app/dashboard" replace />
    : <Onboarding />;
}

function DashboardRoute() {
  const { state } = useMailMind();
  return state.connection.status === 'connected'
    ? <AppShell />
    : <Navigate to="/onboarding" replace />;
}

function ClientRoute() {
  const { state } = useMailMind();
  return state.connection.status === 'connected'
    ? <ClientShell />
    : <Navigate to="/onboarding" replace />;
}

function RouteAccessibility() {
  const { pathname, search } = useLocation();
  const routeKey = pathname === '/onboarding' ? `${pathname}${search}` : pathname;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const pageTitle = document.querySelector<HTMLElement>('[data-page-title]')?.dataset.pageTitle?.trim();
      if (pageTitle) document.title = `${pageTitle} · MailMind`;
      document.getElementById('main-content')?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [routeKey]);

  return null;
}

export function App() {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <RouteAccessibility />
      <Routes>
        <Route path="/" element={<EntryRedirect />} />
        <Route path="/onboarding" element={<OnboardingRoute />} />
        <Route path="/app" element={<DashboardRoute />}>
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="inbox/:segment" element={<SegmentView />} />
          <Route path="inbox/:segment/:conversationId" element={<SegmentView />} />
          <Route path="upcoming" element={<UpcomingDatesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="design" element={<DesignPreview />} />
        </Route>
        <Route path="/client" element={<ClientRoute />}>
          <Route index element={<ClientQueuePage />} />
          <Route path=":id" element={<ClientReviewPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
