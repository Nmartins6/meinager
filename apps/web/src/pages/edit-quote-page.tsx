import { ArrowLeft, Pencil } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import { useClientsQuery } from '@/features/clients/use-clients-query';
import { FinancialNavigation } from '@/features/finance/financial-navigation';
import { QuoteForm, type QuoteFormData } from '@/features/quotes/quote-form';
import type { Quote } from '@/features/quotes/quotes-api';
import { useQuoteQuery } from '@/features/quotes/use-quote-query';
import { useUpdateQuoteMutation } from '@/features/quotes/use-update-quote-mutation';
import { useProductsQuery } from '@/features/products/use-products-query';

function quoteToFormData(quote: Quote): QuoteFormData {
  return {
    clientId: quote.client.id,
    validUntil: quote.validUntil?.slice(0, 10) ?? '',
    discount: quote.discount,
    notes: quote.notes ?? '',
    items: quote.items.map((item) => ({
      productId: item.productId ?? '',
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
  const clientsQuery = useClientsQuery({
    isActive: true,
    page: 1,
    pageSize: 100,
  });
  const productsQuery = useProductsQuery({
    isActive: true,
    page: 1,
    pageSize: 100,
  });
  const updateQuoteMutation = useUpdateQuoteMutation();

  const role = currentUserQuery.data?.organization.role;
  const canManage = role === 'OWNER' || role === 'ADMIN' || role === 'OPERATIONS';

  const quote = quoteQuery.data;
  const clients = clientsQuery.data?.data ?? [];
  const products = productsQuery.data?.data ?? [];

  const isLoadingDependencies =
    currentUserQuery.isPending ||
    quoteQuery.isPending ||
    clientsQuery.isPending ||
    productsQuery.isPending;

  const dependencyError =
    currentUserQuery.error ?? quoteQuery.error ?? clientsQuery.error ?? productsQuery.error;

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
        <p
          role="alert"
          className="mt-8 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {dependencyError.message}
        </p>
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
        clients.length === 0 && (
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
        clients.length > 0 && (
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
                clients={clients}
                products={products}
                initialValues={quoteToFormData(quote)}
                submitLabel="Salvar alterações"
                isPending={updateQuoteMutation.isPending}
                errorMessage={updateQuoteMutation.error?.message}
                onSubmit={handleSubmit}
                onCancel={() => navigate(`/app/financeiro/orcamentos/${quote.id}`)}
              />
            </CardContent>
          </Card>
        )}
    </section>
  );
}
