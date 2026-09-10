import { FileText } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { FinancialNavigation } from '@/features/finance/financial-navigation';
import { type QuoteStatus } from '@/features/quotes/quotes-api';
import { useQuotesQuery } from '@/features/quotes/use-quotes-query';
import { cn } from '@/lib/utils';

const quoteStatusLabels: Record<QuoteStatus, string> = {
  DRAFT: 'Rascunho',
  SENT: 'Enviado',
  APPROVED: 'Aprovado',
  REJECTED: 'Recusado',
  EXPIRED: 'Expirado',
  CANCELLED: 'Cancelado',
};

type QuoteStatusFilter = QuoteStatus | 'ALL';

function formatDate(value: string | null): string {
  if (!value) {
    return 'Não informada';
  }

  const [year, month, day] = value.slice(0, 10).split('-');

  return `${day}/${month}/${year}`;
}

function formatCurrency(value: string): string {
  const [integerPart, decimalPart = '00'] = value.split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `R$ ${formattedInteger},${decimalPart}`;
}

export function QuotesPage() {
  const [status, setStatus] = useState<QuoteStatusFilter>('ALL');
  const [page, setPage] = useState(1);

  const quotesQuery = useQuotesQuery({
    status: status === 'ALL' ? undefined : status,
    page,
    pageSize: 10,
  });

  const response = quotesQuery.data;

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Orçamentos</h1>
        <p className="mt-2 text-muted-foreground">
          Consulte as propostas comerciais emitidas para seus clientes.
        </p>
      </div>

      <FinancialNavigation />

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Orçamentos emitidos</CardTitle>
          <CardDescription>
            {response
              ? `${response.pagination.total} orçamento(s) encontrado(s).`
              : 'Carregando seus orçamentos.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="quote-status-filter">Status</Label>
            <select
              id="quote-status-filter"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as QuoteStatusFilter);
                setPage(1);
              }}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="ALL">Todos</option>
              <option value="DRAFT">Rascunhos</option>
              <option value="SENT">Enviados</option>
              <option value="APPROVED">Aprovados</option>
              <option value="REJECTED">Recusados</option>
              <option value="EXPIRED">Expirados</option>
              <option value="CANCELLED">Cancelados</option>
            </select>
          </div>

          {quotesQuery.isPending && (
            <p role="status" className="py-12 text-center text-muted-foreground">
              Carregando orçamentos...
            </p>
          )}

          {quotesQuery.isError && (
            <div className="mt-6 space-y-3">
              <p
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {quotesQuery.error.message}
              </p>

              <Button
                type="button"
                variant="outline"
                onClick={() => void quotesQuery.refetch()}
                disabled={quotesQuery.isFetching}
              >
                Tentar novamente
              </Button>
            </div>
          )}

          {response && response.data.length === 0 && (
            <div className="grid place-items-center py-14 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-primary/10">
                <FileText className="size-6 text-primary" />
              </div>
              <p className="mt-4 font-medium">Nenhum orçamento encontrado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Altere o filtro selecionado ou crie uma nova proposta.
              </p>
            </div>
          )}

          {response && response.data.length > 0 && (
            <>
              <div
                className="mt-6 overflow-x-auto rounded-lg border"
                aria-busy={quotesQuery.isFetching}
              >
                <table className="w-full min-w-3xl text-left text-sm">
                  <caption className="sr-only">Orçamentos da organização</caption>
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Número
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Cliente
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Validade
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        Itens
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        Total
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {response.data.map((quote) => (
                      <tr key={quote.id} className="border-t bg-background">
                        <td className="px-4 py-3 font-medium">Orçamento #{quote.number}</td>
                        <td className="px-4 py-3 text-muted-foreground">{quote.client.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(quote.validUntil)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{quote._count.items}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {formatCurrency(quote.total)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'rounded-full px-2.5 py-1 text-xs font-medium',
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex flex-col items-center justify-between gap-3 sm:flex-row">
                <p className="text-sm text-muted-foreground">
                  Página {response.pagination.page} de {Math.max(response.pagination.totalPages, 1)}
                </p>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPage((current) => Math.max(current - 1, 1))}
                    disabled={page <= 1 || quotesQuery.isFetching}
                  >
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPage((current) => current + 1)}
                    disabled={page >= response.pagination.totalPages || quotesQuery.isFetching}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
