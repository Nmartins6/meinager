import { Building2, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import { useLogoutMutation } from '@/features/auth/use-logout-mutation';

export function DashboardPage() {
  const navigate = useNavigate();
  const currentUserQuery = useCurrentUserQuery();
  const logoutMutation = useLogoutMutation();

  const auth = currentUserQuery.data;

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        navigate('/login', { replace: true });
      },
    });
  }

  if (!auth) {
    return null;
  }

  return (
    <main className="min-h-screen bg-muted">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary font-bold text-primary-foreground">
              M
            </span>

            <div>
              <p className="font-semibold">meinager</p>
              <p className="text-sm text-muted-foreground">{auth.organization.name}</p>
            </div>
          </div>

          <Button variant="outline" onClick={handleLogout} disabled={logoutMutation.isPending}>
            <LogOut data-icon="inline-start" />
            {logoutMutation.isPending ? 'Saindo...' : 'Sair'}
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-start gap-4">
          <div className="grid size-12 place-items-center rounded-2xl bg-primary/10">
            <Building2 className="size-6 text-primary" />
          </div>

          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Visão geral</h1>
            <p className="mt-2 text-muted-foreground">
              Olá, {auth.user.name}. Esta é a área da empresa {auth.organization.name}.
            </p>
          </div>
        </div>

        {logoutMutation.isError && (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {logoutMutation.error.message}
          </p>
        )}
      </section>
    </main>
  );
}
