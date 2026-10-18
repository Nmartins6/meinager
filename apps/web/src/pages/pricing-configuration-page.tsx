import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import { PricingConfigurationForm } from '@/features/pricing/pricing-configuration-form';
import { getPricingPermissions } from '@/features/pricing/pricing-permissions';
import { ProductsPricingNavigation } from '@/features/pricing/products-pricing-navigation';
import { usePricingConfigurationQuery } from '@/features/pricing/use-pricing-configuration-query';
import { ApiError } from '@/lib/api';

export function PricingConfigurationPage() {
  const currentUserQuery = useCurrentUserQuery();
  const permissions = getPricingPermissions(currentUserQuery.data?.organization.role);
  const configurationQuery = usePricingConfigurationQuery(permissions.viewConfiguration);
  const [isCreating, setIsCreating] = useState(false);

  if (currentUserQuery.isPending) {
    return (
      <section className="mx-auto max-w-5xl px-6 py-10">
        <p role="status" className="text-muted-foreground">
          Verificando acesso...
        </p>
      </section>
    );
  }

  if (!permissions.viewConfiguration) {
    return (
      <section className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Configuração de precificação</h1>
        <Card className="mt-6">
          <CardContent className="py-10 text-center">
            <p className="font-medium">
              O acesso à precificação interna não está disponível para seu papel.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  const notFound =
    configurationQuery.error instanceof ApiError &&
    configurationQuery.error.code === 'PRICING_CONFIGURATION_NOT_FOUND';

  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Configuração de precificação</h1>
        <p className="mt-2 text-muted-foreground">
          Defina parâmetros organizacionais usados como entrada dos cálculos futuros.
        </p>
      </div>

      <ProductsPricingNavigation />

      {configurationQuery.isPending && (
        <p role="status" className="py-12 text-center text-muted-foreground">
          Carregando configuração de precificação...
        </p>
      )}

      {configurationQuery.isError && !notFound && !configurationQuery.data && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Não foi possível carregar a configuração</CardTitle>
            <CardDescription role="alert">{configurationQuery.error.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              onClick={() => void configurationQuery.refetch()}
              disabled={configurationQuery.isFetching}
            >
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {notFound && !isCreating && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Nenhuma configuração cadastrada</CardTitle>
            <CardDescription>
              A organização ainda não possui parâmetros globais de precificação.
            </CardDescription>
          </CardHeader>
          {permissions.editConfiguration && (
            <CardContent>
              <Button type="button" onClick={() => setIsCreating(true)}>
                Criar configuração
              </Button>
            </CardContent>
          )}
        </Card>
      )}

      {(configurationQuery.data || (notFound && isCreating)) && (
        <div className="mt-8">
          <PricingConfigurationForm
            configuration={configurationQuery.data ?? null}
            canEdit={permissions.editConfiguration}
            onCancel={configurationQuery.data ? undefined : () => setIsCreating(false)}
            onReload={async () => {
              const result = await configurationQuery.refetch();
              if (!result.isSuccess || !result.data) {
                return {
                  success: false,
                  error: result.error?.message ?? 'Não foi possível recarregar a configuração.',
                } as const;
              }

              setIsCreating(false);
              return { success: true, configuration: result.data } as const;
            }}
          />
        </div>
      )}
    </section>
  );
}
