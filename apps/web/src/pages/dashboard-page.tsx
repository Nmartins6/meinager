import { Building2 } from 'lucide-react';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';

export function DashboardPage() {
  const currentUserQuery = useCurrentUserQuery();
  const auth = currentUserQuery.data;

  if (!auth) {
    return null;
  }

  return (
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
    </section>
  );
}
