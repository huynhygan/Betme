import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Screen } from './ui/Screen';
import { Skeleton } from './ui/Skeleton';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Screen>
        <div role="status" aria-label="Loading" className="flex flex-col gap-3">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="mt-4 h-12 w-full rounded-xl" />
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
