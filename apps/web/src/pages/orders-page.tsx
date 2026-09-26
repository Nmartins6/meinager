import { ClipboardList, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { FinancialNavigation } from '@/features/finance/financial-navigation';
import { type OrderStatus } from '@/features/orders/orders-api';
import { useOrdersQuery } from '@/features/orders/use-orders-query';
import { orderStatusClassNames } from '@/features/orders/order-presentation';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import { cn } from '@/lib/utils';

type OrderStatusFilter = OrderStatus | 'ALL';

function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-');

  return `${day}/${month}/${year}`;
}

function formatCurrency(value: string): string {
  const [integerPart, decimalPart = ''] = value.split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `R$ ${formattedInteger},${decimalPart.padEnd(2, '0').slice(0, 2)}`;
}

export function OrdersPage() {
  const [status, setStatus] = useState<OrderStatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const currentUserQuery = useCurrentUserQuery();
  const role = currentUserQuery.data?.organization.role;
  const canConfigureWorkflows = role === 'OWNER' || role === 'ADMIN';

  const ordersQuery = useOrdersQuery({
    status: status === 'ALL' ? undefined : status,
    page,
    pageSize: 10,
  });

  const response = ordersQuery.data;

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Pedidos</h1>
          <p className="mt-2 text-muted-foreground">
            Acompanhe as etapas dos pedidos da sua organização.
          </p>
        </div>

        {canConfigureWorkflows && (
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/app/financeiro/pedidos/fluxos')}
          >
            <Settings2 data-icon="inline-start" />
            Configurar fluxos
          </Button>
        )}
      </div>

      <FinancialNavigation />

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Pedidos em andamento</CardTitle>
          <CardDescription>
            {response
              ? `${response.pagination.total} pedido(s) encontrado(s).`
              : 'Carregando seus pedidos.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="order-status-filter">Status</Label>
            <select
              id="order-status-filter"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as OrderStatusFilter);
                setPage(1);
              }}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="ALL">Todos</option>
              <option value="PENDING">Pendentes</option>
              <option value="IN_PROGRESS">Em andamento</option>
              <option value="COMPLETED">Concluídos</option>
              <option value="CANCELLED">Cancelados</option>
            </select>
          </div>

          {ordersQuery.isPending && (
            <p role="status" className="py-12 text-center text-muted-foreground">
              Carregando pedidos...
            </p>
          )}

          {ordersQuery.isError && (
            <div className="mt-6 space-y-3">
              <p
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {ordersQuery.error.message}
              </p>

              <Button
                type="button"
                variant="outline"
                onClick={() => void ordersQuery.refetch()}
                disabled={ordersQuery.isFetching}
              >
                Tentar novamente
              </Button>
            </div>
          )}

          {response && response.data.length === 0 && (
            <div className="grid place-items-center py-14 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-primary/10">
                <ClipboardList className="size-6 text-primary" />
              </div>
              <p className="mt-4 font-medium">Nenhum pedido encontrado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Os pedidos são criados a partir de orçamentos aprovados.
              </p>
            </div>
          )}

          {response && response.data.length > 0 && (
            <>
              <div
                className="mt-6 overflow-x-auto rounded-lg border"
                aria-busy={ordersQuery.isFetching}
              >
                <table className="w-full min-w-3xl text-left text-sm">
                  <caption className="sr-only">Pedidos da organização</caption>
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Número
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Cliente
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Origem
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
                      <th scope="col" className="px-4 py-3 font-medium">
                        Criado em
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {response.data.map((order) => (
                      <tr key={order.id} className="border-t bg-background">
                        <td className="px-4 py-3 font-medium">
                          <button
                            type="button"
                            className="text-left text-primary hover:underline"
                            onClick={() => navigate(`/app/financeiro/pedidos/${order.id}`)}
                          >
                            Pedido #{order.number}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{order.client.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          Orçamento #{order.quote.number}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{order._count.items}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {formatCurrency(order.total)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'rounded-full px-2.5 py-1 text-xs font-medium',
                              orderStatusClassNames[order.status],
                            )}
                          >
                            {order.currentStage.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(order.createdAt)}
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
                    disabled={page <= 1 || ordersQuery.isFetching}
                  >
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPage((current) => current + 1)}
                    disabled={page >= response.pagination.totalPages || ordersQuery.isFetching}
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
