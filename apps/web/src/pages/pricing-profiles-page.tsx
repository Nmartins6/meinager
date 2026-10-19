import { Plus, Tags } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import { getPricingPermissions } from '@/features/pricing/pricing-permissions';
import { PricingProfileForm } from '@/features/pricing/pricing-profile-form';
import { ProductsPricingNavigation } from '@/features/pricing/products-pricing-navigation';
import { usePricingProfilesQuery } from '@/features/pricing/use-pricing-profiles-query';
import { cn } from '@/lib/utils';

type StatusFilter = 'all' | 'active' | 'inactive';

export function PricingProfilesPage() {
  const currentUserQuery = useCurrentUserQuery();
  const permissions = getPricingPermissions(currentUserQuery.data?.organization.role);
  const [status, setStatus] = useState<StatusFilter>('active');
  const [page, setPage] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();
  const filters = {
    page,
    pageSize: 20,
    isActive: status === 'all' ? undefined : status === 'active',
  };
  const profilesQuery = usePricingProfilesQuery(filters, permissions.viewProfiles);

  if (currentUserQuery.isPending) {
    return (
      <p role="status" className="p-10 text-center">
        Carregando permissões...
      </p>
    );
  }

  if (!permissions.viewProfiles) {
    return (
      <section className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold">Perfis de venda</h1>
        <p role="alert" className="mt-5 rounded-lg bg-muted p-4 text-sm">
          Os dados internos de perfis de venda não estão disponíveis para seu papel.
        </p>
      </section>
    );
  }

  if (isCreating) {
    return (
      <section className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold">Criar perfil de venda</h1>
        <p className="mt-2 text-muted-foreground">
          Defina o nome e as deduções na ordem em que devem ser aplicadas.
        </p>
        <div className="mt-8">
          <PricingProfileForm
            profile={null}
            canEdit={permissions.editProfiles}
            onCancel={() => setIsCreating(false)}
            onSaved={(profile) => navigate(`/app/produtos/precificacao/perfis/${profile.id}`)}
          />
        </div>
      </section>
    );
  }

  const response = profilesQuery.isError ? undefined : profilesQuery.data;

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Perfis de venda</h1>
        <p className="mt-2 text-muted-foreground">
          Consulte os canais comerciais e suas deduções ordenadas.
        </p>
      </div>
      <ProductsPricingNavigation />

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Perfis cadastrados</CardTitle>
          <CardDescription>
            {response
              ? `${response.pagination.total} perfil(is) encontrado(s).`
              : 'Carregando perfis.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full space-y-2 sm:max-w-xs">
              <Label htmlFor="profile-status">Estado</Label>
              <select
                id="profile-status"
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as StatusFilter);
                  setPage(1);
                }}
              >
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
                <option value="all">Todos</option>
              </select>
            </div>
            {permissions.editProfiles && (
              <Button onClick={() => setIsCreating(true)}>
                <Plus data-icon="inline-start" />
                Criar perfil
              </Button>
            )}
          </div>

          {profilesQuery.isFetching && (
            <p role="status" className="py-8 text-center text-muted-foreground">
              {profilesQuery.isPending ? 'Carregando perfis...' : 'Atualizando perfis...'}
            </p>
          )}

          {profilesQuery.isError && (
            <div className="mt-6 space-y-3">
              <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {profilesQuery.error.message}
              </p>
              <Button
                variant="outline"
                onClick={() => void profilesQuery.refetch()}
                disabled={profilesQuery.isFetching}
              >
                Tentar novamente
              </Button>
            </div>
          )}

          {response?.data.length === 0 && (
            <div className="grid place-items-center py-14 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-primary/10">
                <Tags className="size-6 text-primary" />
              </div>
              <p className="mt-4 font-medium">Nenhum perfil encontrado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Altere o filtro ou crie um perfil.
              </p>
            </div>
          )}

          {response && response.data.length > 0 && (
            <div
              className="mt-6 overflow-x-auto rounded-lg border"
              aria-busy={profilesQuery.isFetching}
            >
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Perfis de venda da organização</caption>
                <thead className="bg-muted/60 text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Nome
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Estado
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Revisão
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {response.data.map((profile) => (
                    <tr key={profile.id} className="border-t">
                      <td className="px-4 py-3 font-medium">{profile.currentRevision.name}</td>
                      <td className="px-4 py-3">{profile.isActive ? 'Ativo' : 'Inativo'}</td>
                      <td className="px-4 py-3 tabular-nums">{profile.currentRevision.revision}</td>
                      <td className="px-4 py-3">
                        <Link
                          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                          to={`/app/produtos/precificacao/perfis/${profile.id}`}
                        >
                          Abrir detalhe
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {response && (
            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Página {response.pagination.page} de {Math.max(response.pagination.totalPages, 1)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1 || profilesQuery.isFetching}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={page >= response.pagination.totalPages || profilesQuery.isFetching}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
