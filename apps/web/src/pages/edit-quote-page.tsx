import { ArrowLeft, Pencil } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import { FinancialNavigation } from '@/features/finance/financial-navigation';
import { QuoteForm, type QuoteFormData } from '@/features/quotes/quote-form';
import type { Quote } from '@/features/quotes/quotes-api';
import { useQuoteQuery } from '@/features/quotes/use-quote-query';
import { useUpdateQuoteMutation } from '@/features/quotes/use-update-quote-mutation';
import {
  useQuoteClientsQuery,
  useQuoteProductsQuery,
} from '@/features/quotes/use-quote-options-query';

function quoteToFormData(quote: Quote): QuoteFormData {
  return {
    clientId: quote.client.id,
    validUntil: quote.validUntil?.slice(0, 10) ?? '',
    discount: quote.discount,
    notes: quote.notes ?? '',
    items: quote.items.map((item) => ({
      productId: item.productId ?? '',
      sourceItemId: item.id,
      priceSelection: 'PRESERVE',
      expectedProductUpdatedAt: '',
      expectedAdoptedPricingVersionId: '',
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      notes: item.notes ?? '',
    })),
  };
}

export function EditQuotePage() {
  const navigate = useNavigate();
  const { quoteId } = useParams();

  const currentUserQuery = useCurrentUserQuery();
  const quoteQuery = useQuoteQuery(quoteId);
  const role = currentUserQuery.data?.organization.role;
  const canManage = role === 'OWNER' || role === 'ADMIN' || role === 'OPERATIONS';
  const clientsQuery = useQuoteClientsQuery(canManage);
  const productsQuery = useQuoteProductsQuery(canManage);
  const updateQuoteMutation = useUpdateQuoteMutation();

  const quote = quoteQuery.data;
  const clients = clientsQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const clientOptions =
    quote && !clients.some((client) => client.id === quote.client.id)
      ? [...clients, quote.client]
      : clients;
  const productOptions = [...products];
  for (const item of quote?.items ?? []) {
    if (item.productId && !productOptions.some((product) => product.id === item.productId)) {
      productOptions.push({
        id: item.productId,
        name: `${item.description} (histórico)`,
        unit: item.unit,
        salePrice: null,
        adoptedPricingVersionId: undefined,
        updatedAt: '',
      } as (typeof products)[number]);
    }
  }

  const isLoadingDependencies =
    currentUserQuery.isPending ||
    quoteQuery.isPending ||
    (canManage && (clientsQuery.isPending || productsQuery.isPending));

  const dependencyError =
    currentUserQuery.error ??
    quoteQuery.error ??
    (canManage ? (clientsQuery.error ?? productsQuery.error) : null);

  function handleSubmit(data: QuoteFormData) {
    if (!quote) {
      return;
    }

    updateQuoteMutation.mutate(
      {
        quoteId: quote.id,
        input: {
          clientId: data.clientId,
          validUntil: data.validUntil || null,
          discount: data.discount.trim() || null,
          notes: data.notes.trim() || null,
          items: data.items.map((item) => ({
            productId: item.productId || undefined,
            sourceItemId:
              item.priceSelection === 'PRESERVE' ? item.sourceItemId || undefined : undefined,
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
      },
      {
        onSuccess: () => {
          navigate(`/app/financeiro/orcamentos/${quote.id}`, {
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
          onClick={() => navigate(`/app/financeiro/orcamentos/${quoteId ?? ''}`)}
        >
          <ArrowLeft data-icon="inline-start" />
          Voltar ao orçamento
        </Button>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Editar orçamento</h1>
        <p className="mt-2 text-muted-foreground">
          Altere os dados da proposta enquanto ela ainda estiver em rascunho.
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
            Não foi possível carregar o orçamento e suas opções.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={quoteQuery.isFetching || clientsQuery.isFetching || productsQuery.isFetching}
            onClick={() => {
              if (quoteQuery.isError) void quoteQuery.refetch();
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
            <p className="font-medium">Você não possui permissão para editar orçamentos.</p>
          </CardContent>
        </Card>
      )}

      {!isLoadingDependencies &&
        !dependencyError &&
        canManage &&
        quote &&
        quote.status !== 'DRAFT' && (
          <Card className="mt-8">
            <CardContent className="py-12 text-center">
              <p className="font-medium">Somente orçamentos em rascunho podem ser editados.</p>
            </CardContent>
          </Card>
        )}

      {!isLoadingDependencies &&
        !dependencyError &&
        canManage &&
        quote?.status === 'DRAFT' &&
        clientOptions.length === 0 && (
          <Card className="mt-8">
            <CardContent className="py-12 text-center">
              <p className="font-medium">Nenhum cliente ativo disponível</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Cadastre ou reative um cliente antes de editar o orçamento.
              </p>
            </CardContent>
          </Card>
        )}

      {!isLoadingDependencies &&
        !dependencyError &&
        canManage &&
        quote?.status === 'DRAFT' &&
        clientOptions.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-primary/10">
                  <Pencil className="size-5 text-primary" />
                </div>

                <div>
                  <CardTitle>Dados da proposta</CardTitle>
                  <CardDescription>
                    Os totais são recalculados e confirmados pelo servidor ao salvar as alterações.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <QuoteForm
                key={quote.id}
                clients={clientOptions}
                products={productOptions}
                initialValues={quoteToFormData(quote)}
                submitLabel="Salvar alterações"
                isPending={updateQuoteMutation.isPending}
                errorMessage={updateQuoteMutation.error?.message}
                onRefreshCatalog={async () => {
                  const refreshed = await productsQuery.refetch();
                  if (refreshed.isError || !refreshed.data)
                    throw new Error('Falha ao atualizar catálogo.');
                  updateQuoteMutation.reset();
                  return refreshed.data;
                }}
                onSubmit={handleSubmit}
                onCancel={() => navigate(`/app/financeiro/orcamentos/${quote.id}`)}
              />
            </CardContent>
          </Card>
        )}
    </section>
  );
}
