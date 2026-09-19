import { ArrowLeft, Pencil } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import { FinancialNavigation } from '@/features/finance/financial-navigation';
import { type QuoteLifecycleAction, type QuoteStatus } from '@/features/quotes/quotes-api';
import { useQuoteLifecycleMutation } from '@/features/quotes/use-quote-lifecycle-mutation';
import { useQuoteQuery } from '@/features/quotes/use-quote-query';
import { cn } from '@/lib/utils';

const quoteStatusLabels: Record<QuoteStatus, string> = {
  DRAFT: 'Rascunho',
  SENT: 'Enviado',
  APPROVED: 'Aprovado',
  REJECTED: 'Recusado',
  EXPIRED: 'Expirado',
  CANCELLED: 'Cancelado',
};

const lifecycleActionsByStatus: Record<QuoteStatus, QuoteLifecycleAction[]> = {
  DRAFT: ['send', 'cancel'],
  SENT: ['approve', 'reject', 'cancel'],
  APPROVED: [],
  REJECTED: [],
  EXPIRED: [],
  CANCELLED: [],
};

const lifecycleActionLabels: Record<QuoteLifecycleAction, string> = {
  send: 'Enviar orçamento',
  approve: 'Aprovar orçamento',
  reject: 'Recusar orçamento',
  cancel: 'Cancelar orçamento',
};

function formatCurrency(value: string): string {
  const [integerPart, decimalPart = ''] = value.split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `R$ ${formattedInteger},${decimalPart.padEnd(2, '0').slice(0, 2)}`;
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'Não informada';
  }

  const [year, month, day] = value.slice(0, 10).split('-');

  return `${day}/${month}/${year}`;
}

export function QuotePage() {
  const navigate = useNavigate();
  const { quoteId } = useParams();

  const currentUserQuery = useCurrentUserQuery();
  const quoteQuery = useQuoteQuery(quoteId);

  const lifecycleMutation = useQuoteLifecycleMutation();

  const role = currentUserQuery.data?.organization.role;
  const canManage = role === 'OWNER' || role === 'ADMIN' || role === 'OPERATIONS';

  const quote = quoteQuery.data;
  const error = currentUserQuery.error ?? quoteQuery.error;

  const availableActions = quote ? lifecycleActionsByStatus[quote.status] : [];

  function handleLifecycleAction(action: QuoteLifecycleAction) {
    if (!quote) {
      return;
    }

    lifecycleMutation.mutate({
      quoteId: quote.id,
      action,
    });
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <Button
        type="button"
        variant="outline"
        onClick={() => navigate('/app/financeiro/orcamentos')}
      >
        <ArrowLeft data-icon="inline-start" />
        Voltar aos orçamentos
      </Button>

      <FinancialNavigation />

      {(currentUserQuery.isPending || quoteQuery.isPending) && (
        <p role="status" className="py-16 text-center text-muted-foreground">
          Carregando orçamento...
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-8 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error.message}
        </p>
      )}

      {quote && (
        <>
          <div className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Orçamento #{quote.number}</h1>
              <p className="mt-2 text-muted-foreground">Proposta para {quote.client.name}.</p>
            </div>

            <div className="flex items-center gap-3">
              {canManage && quote.status === 'DRAFT' && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/app/financeiro/orcamentos/${quote.id}/editar`)}
                >
                  <Pencil data-icon="inline-start" />
                  Editar
                </Button>
              )}

              {
                <span
                  className={cn(
                    'w-fit rounded-full px-2.5 py-1 text-xs font-medium',
                    quote.status === 'DRAFT' && 'bg-blue-100 text-blue-800',
                    quote.status === 'SENT' && 'bg-amber-100 text-amber-800',
                    quote.status === 'APPROVED' && 'bg-emerald-100 text-emerald-800',
                    quote.status === 'REJECTED' && 'bg-red-100 text-red-800',
                    (quote.status === 'EXPIRED' || quote.status === 'CANCELLED') &&
                      'bg-zinc-200 text-zinc-700',
                  )}
                >
                  {quoteStatusLabels[quote.status]}
                </span>
              }
            </div>
          </div>

          {canManage && availableActions.length > 0 && (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Ações do orçamento</CardTitle>
                <CardDescription>
                  As opções disponíveis dependem do status atual da proposta.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {availableActions.map((action) => (
                    <Button
                      key={action}
                      type="button"
                      variant={action === 'send' || action === 'approve' ? 'default' : 'outline'}
                      onClick={() => handleLifecycleAction(action)}
                      disabled={lifecycleMutation.isPending}
                    >
                      {lifecycleMutation.isPending
                        ? 'Atualizando...'
                        : lifecycleActionLabels[action]}
                    </Button>
                  ))}
                </div>

                {lifecycleMutation.error && (
                  <p
                    role="alert"
                    className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
                  >
                    {lifecycleMutation.error.message}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {!currentUserQuery.isPending && !canManage && (
            <p className="mt-8 text-sm text-muted-foreground">
              Você possui acesso somente para consulta deste orçamento.
            </p>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <Card>
              <CardHeader>
                <CardTitle>Itens do orçamento</CardTitle>
                <CardDescription>
                  Valores preservados no momento da criação da proposta.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <caption className="sr-only">Itens do orçamento #{quote.number}</caption>
                    <thead className="bg-muted/60 text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-medium">
                          Item
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">
                          Unidade
                        </th>
                        <th scope="col" className="px-4 py-3 text-right font-medium">
                          Quantidade
                        </th>
                        <th scope="col" className="px-4 py-3 text-right font-medium">
                          Preço unitário
                        </th>
                        <th scope="col" className="px-4 py-3 text-right font-medium">
                          Total
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {quote.items.map((item) => (
                        <tr key={item.id} className="border-t bg-background">
                          <td className="px-4 py-3">
                            <p className="font-medium">{item.description}</p>
                            {item.notes && (
                              <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{item.unit}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{item.quantity}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatCurrency(item.unitPrice)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums">
                            {formatCurrency(item.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {quote.notes && (
                  <div className="mt-6 rounded-lg border p-4">
                    <h2 className="text-sm font-medium">Observações</h2>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {quote.notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Resumo</CardTitle>
                </CardHeader>

                <CardContent>
                  <dl className="space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Cliente</dt>
                      <dd className="text-right font-medium">{quote.client.name}</dd>
                    </div>

                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Válido até</dt>
                      <dd className="text-right">{formatDate(quote.validUntil)}</dd>
                    </div>

                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Subtotal</dt>
                      <dd className="tabular-nums">{formatCurrency(quote.subtotal)}</dd>
                    </div>

                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Desconto</dt>
                      <dd className="tabular-nums">{formatCurrency(quote.discount)}</dd>
                    </div>

                    <div className="flex justify-between gap-4 border-t pt-3 text-base">
                      <dt className="font-medium">Total</dt>
                      <dd className="font-semibold tabular-nums">{formatCurrency(quote.total)}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Status</CardTitle>
                </CardHeader>

                <CardContent className="space-y-3 text-sm">
                  {quote.sentAt && (
                    <p>
                      <span className="text-muted-foreground">Enviado em: </span>
                      {formatDate(quote.sentAt)}
                    </p>
                  )}

                  {quote.approvedAt && (
                    <p>
                      <span className="text-muted-foreground">Aprovado em: </span>
                      {formatDate(quote.approvedAt)}
                    </p>
                  )}

                  {quote.rejectedAt && (
                    <p>
                      <span className="text-muted-foreground">Recusado em: </span>
                      {formatDate(quote.rejectedAt)}
                    </p>
                  )}

                  {quote.cancelledAt && (
                    <p>
                      <span className="text-muted-foreground">Cancelado em: </span>
                      {formatDate(quote.cancelledAt)}
                    </p>
                  )}

                  {!quote.sentAt &&
                    !quote.approvedAt &&
                    !quote.rejectedAt &&
                    !quote.cancelledAt && (
                      <p className="text-muted-foreground">Nenhuma mudança de status registrada.</p>
                    )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
