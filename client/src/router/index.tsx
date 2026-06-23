import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { FullPageSkeleton } from '../components/skeletons/FullPageSkeleton';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PageTransition } from '../components/layout/PageTransition';
import { CallOverlay } from '../components/calls/CallOverlay';

// Lazy load pages for performance
const AuthPage = React.lazy(() => import('../pages/AuthPage'));
const ChatPage = React.lazy(() => import('../pages/ChatPage'));
const NotFoundPage = React.lazy(() => import('../pages/NotFoundPage'));
const JoinGroupPage = React.lazy(() => import('../pages/JoinGroupPage'));
const InviteResolver = React.lazy(() => import('../pages/InviteResolver'));
const GroupsPage = React.lazy(() => import('../pages/GroupsPage'));
const StatusPage = React.lazy(() => import('../pages/StatusPage'));
const FriendsPage = React.lazy(() => import('../pages/FriendsPage'));
const ForgotPasswordPage = React.lazy(() => import('../pages/ForgotPasswordPage'));
const ResetPasswordPage = React.lazy(() => import('../pages/ResetPasswordPage'));
const SettingsPage = React.lazy(() => import('../pages/SettingsPage'));
const CallsPage = React.lazy(() => import('../pages/CallsPage'));
const CipherScreen = React.lazy(() => import('../pages/CipherScreen'));
const GroupPage = React.lazy(() => import('../pages/GroupPage'));
const DirectMessagePage = React.lazy(() => import('../pages/DirectMessagePage'));

// Protected Route Guard
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/auth" replace />;
  return <PageTransition>{children}</PageTransition>;
};

// Public Route Guard
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  if (user) {
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem('pendingInvite');
      if (pending) sessionStorage.removeItem('pendingInvite');
    } catch { /* ignore */ }
    return <Navigate to={pending ? `/invite/${pending}` : '/chat'} replace />;
  }
  return <PageTransition>{children}</PageTransition>;
};

export const AppRoutes: React.FC = () => {
  return (
    <ErrorBoundary>
      <React.Suspense fallback={<FullPageSkeleton />}>
        <CallOverlay />
        <Routes>
          <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
          <Route path="/chat" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
          <Route path="/group/:id" element={<PrivateRoute><GroupPage /></PrivateRoute>} />
          <Route path="/dm/:username" element={<PrivateRoute><DirectMessagePage /></PrivateRoute>} />
          <Route path="/calls" element={<PrivateRoute><CallsPage /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
          <Route path="/status" element={<PrivateRoute><StatusPage /></PrivateRoute>} />
          <Route path="/friends" element={<PrivateRoute><FriendsPage /></PrivateRoute>} />
          <Route path="/groups" element={<PrivateRoute><GroupsPage /></PrivateRoute>} />
          <Route path="/cipher" element={<PrivateRoute><CipherScreen /></PrivateRoute>} />
          <Route path="/cipher/:conversationId" element={<PrivateRoute><CipherScreen /></PrivateRoute>} />
          <Route path="/forgot-password" element={<PageTransition><ForgotPasswordPage /></PageTransition>} />
          <Route path="/reset-password" element={<PageTransition><ResetPasswordPage /></PageTransition>} />
          <Route path="/u/:username" element={<PageTransition><InviteResolver /></PageTransition>} />
          <Route path="/invite/:token" element={<PageTransition><JoinGroupPage /></PageTransition>} />
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="*" element={<PageTransition><NotFoundPage /></PageTransition>} />
        </Routes>
      </React.Suspense>
    </ErrorBoundary>
  );
};
