import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSessionQuery } from './use-current-user-query';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const currentUserQuery = useSessionQuery();

  if (currentUserQuery.isPending) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6">
        <p role="status" className="text-sm text-muted-foreground">
          Verificando sua sessão...
        </p>
      </main>
    );
  }

  if (currentUserQuery.isError) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!currentUserQuery.data.organization) {
    return <Navigate to="/selecionar-organizacao" replace />;
  }

  return children;
}
