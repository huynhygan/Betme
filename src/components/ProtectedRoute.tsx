import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Screen } from './ui/Screen';
import { Spinner } from './ui/Spinner';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Screen>
        <div className="flex justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      </Screen>
    );
  }

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  if (!profile) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/onboarding?redirect=${redirect}`} replace />;
  }

  return children;
}
