import { ArrowLeft, FilePlus2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import { FinancialNavigation } from '@/features/finance/financial-navigation';
import { QuoteForm, type QuoteFormData } from '@/features/quotes/quote-form';
import { useCreateQuoteMutation } from '@/features/quotes/use-create-quote-mutation';
import {
  useQuoteClientsQuery,
  useQuoteProductsQuery,
} from '@/features/quotes/use-quote-options-query';

export function NewQuotePage() {
  const navigate = useNavigate();

  const currentUserQuery = useCurrentUserQuery();
  const role = currentUserQuery.data?.organization.role;
  const canManage = role === 'OWNER' || role === 'ADMIN' || role === 'OPERATIONS';
  const clientsQuery = useQuoteClientsQuery(canManage);
  const productsQuery = useQuoteProductsQuery(canManage);
  const createQuoteMutation = useCreateQuoteMutation();

  const clients = clientsQuery.data ?? [];
  const products = productsQuery.data ?? [];

  const isLoadingDependencies =
    currentUserQuery.isPending ||
    (canManage && (clientsQuery.isPending || productsQuery.isPending));

  const dependencyError =
    currentUserQuery.error ?? (canManage ? (clientsQuery.error ?? productsQuery.error) : null);

  function handleSubmit(data: QuoteFormData) {
    createQuoteMutation.mutate(
      {
        clientId: data.clientId,
        validUntil: data.validUntil || undefined,
        discount: data.discount.trim() || undefined,
        notes: data.notes.trim() || undefined,
        items: data.items.map((item) => ({
          productId: item.productId || undefined,
          priceSelection: item.priceSelection,
          expectedProductUpdatedAt:
            item.priceSelection === 'CATALOG_NOW' ? item.expectedProductUpdatedAt : undefined,
          expectedAdoptedPricingVersionId:
            item.priceSelection === 'CATALOG_NOW'
              ? item.expectedAdoptedPricingVersionId || null
              : undefined,
          description: item.description.trim(),
          unit: item.unit.trim().toUpperCase(),
          quantity: item.quantity.trim(),
          unitPrice: item.unitPrice.trim(),
          notes: item.notes.trim() || undefined,
        })),
      },
      {
        onSuccess: () => {
          navigate('/app/financeiro/orcamentos', {
            replace: true,
          });
        },
      },
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate('/app/financeiro/orcamentos')}
        >
          <ArrowLeft data-icon="inline-start" />
          Voltar aos orçamentos
        </Button>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Novo orçamento</h1>
        <p className="mt-2 text-muted-foreground">
          Monte uma proposta com itens do catálogo ou itens preenchidos manualmente.
        </p>
      </div>

      <FinancialNavigation />

      {isLoadingDependencies && (
        <p role="status" className="py-16 text-center text-muted-foreground">
          Preparando o formulário...
        </p>
      )}

      {dependencyError && (
        <div className="mt-8 space-y-3">
          <p
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
          >
            Não foi possível carregar todas as opções do orçamento.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={clientsQuery.isFetching || productsQuery.isFetching}
            onClick={() => {
              if (clientsQuery.isError) void clientsQuery.refetch();
              if (productsQuery.isError) void productsQuery.refetch();
            }}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {!isLoadingDependencies && !dependencyError && !canManage && (
        <Card className="mt-8">
          <CardContent className="py-12 text-center">
            <p className="font-medium">Você não possui permissão para criar orçamentos.</p>
          </CardContent>
        </Card>
      )}

      {!isLoadingDependencies && !dependencyError && canManage && clients.length === 0 && (
        <Card className="mt-8">
          <CardContent className="py-12 text-center">
            <p className="font-medium">Nenhum cliente ativo disponível</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Cadastre ou reative um cliente antes de criar um orçamento.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoadingDependencies && !dependencyError && canManage && clients.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10">
                <FilePlus2 className="size-5 text-primary" />
              </div>

              <div>
                <CardTitle>Dados da proposta</CardTitle>
                <CardDescription>
                  Os totais são calculados e validados pelo servidor ao salvar o orçamento.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <QuoteForm
              clients={clients}
              products={products}
              isPending={createQuoteMutation.isPending}
              errorMessage={createQuoteMutation.error?.message}
              onRefreshCatalog={async () => {
                const refreshed = await productsQuery.refetch();
                if (refreshed.isError || !refreshed.data)
                  throw new Error('Falha ao atualizar catálogo.');
                createQuoteMutation.reset();
                return refreshed.data;
              }}
              onSubmit={handleSubmit}
              onCancel={() => navigate('/app/financeiro/orcamentos')}
            />
          </CardContent>
        </Card>
      )}
    </section>
  );
}
