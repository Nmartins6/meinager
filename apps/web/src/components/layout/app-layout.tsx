import { LayoutDashboard, LogOut, Users, WalletCards } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import { useLogoutMutation } from '@/features/auth/use-logout-mutation';
import { cn } from '@/lib/utils';

const navigation = [
  {
    to: '/app',
    label: 'Visão geral',
    icon: LayoutDashboard,
    end: true,
  },
  {
    to: '/app/clientes',
    label: 'Clientes',
    icon: Users,
    end: false,
  },
  {
    to: '/app/financeiro',
    label: 'Financeiro',
    icon: WalletCards,
    end: false,
  },
];

export function AppLayout() {
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
          <NavLink to="/app" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary font-bold text-primary-foreground">
              M
            </span>

            <div>
              <p className="font-semibold">meinager</p>
              <p className="text-sm text-muted-foreground">{auth.organization.name}</p>
            </div>
          </NavLink>

          <Button variant="outline" onClick={handleLogout} disabled={logoutMutation.isPending}>
            <LogOut data-icon="inline-start" />
            {logoutMutation.isPending ? 'Saindo...' : 'Sair'}
          </Button>
        </div>

        <nav
          aria-label="Navegação principal"
          className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6"
        >
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )
                }
              >
                <Icon className="size-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </header>

      {logoutMutation.isError && (
        <div className="mx-auto max-w-7xl px-6 pt-6">
          <p
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {logoutMutation.error.message}
          </p>
        </div>
      )}

      <Outlet />
    </main>
  );
}
