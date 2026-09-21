import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import { FinancialNavigation } from '@/features/finance/financial-navigation';
import { type Order, type OrderLifecycleAction } from '@/features/orders/orders-api';
import { orderStatusClassNames } from '@/features/orders/order-presentation';
import { useOrderLifecycleMutation } from '@/features/orders/use-order-lifecycle-mutation';
import { useOrderQuery } from '@/features/orders/use-order-query';
import { cn } from '@/lib/utils';

function formatCurrency(value: string): string {
  const [integerPart, decimalPart = ''] = value.split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `R$ ${formattedInteger},${decimalPart.padEnd(2, '0').slice(0, 2)}`;
}

function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-');

  return `${day}/${month}/${year}`;
}

function getTransitionDescription(transition: Order['stageTransitions'][number]): string {
  switch (transition.type) {
    case 'CREATED':
      return `Pedido criado na etapa ${transition.nextStage?.name ?? 'inicial'}.`;

    case 'ADVANCED':
      return `Etapa alterada de ${transition.previousStage?.name ?? 'não informada'} para ${
        transition.nextStage?.name ?? 'não informada'
      }.`;

    case 'CANCELLED':
      return `Pedido cancelado na etapa ${transition.previousStage?.name ?? 'atual'}.`;
  }
  return 'Pedido atualizado.';
}

export function OrderPage() {
  const navigate = useNavigate();
  const { orderId } = useParams();

  const currentUserQuery = useCurrentUserQuery();
  const orderQuery = useOrderQuery(orderId);
  const lifecycleMutation = useOrderLifecycleMutation();

  const role = currentUserQuery.data?.organization.role;
  const canManage = role === 'OWNER' || role === 'ADMIN' || role === 'OPERATIONS';

  const order = orderQuery.data;
  const error = currentUserQuery.error ?? orderQuery.error;
  const canTransition =
    order !== undefined && order.status !== 'COMPLETED' && order.status !== 'CANCELLED';

  function handleLifecycleAction(action: OrderLifecycleAction) {
    if (!order) {
      return;
    }

    lifecycleMutation.mutate({
      orderId: order.id,
      action,
    });
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <Button type="button" variant="outline" onClick={() => navigate('/app/financeiro/pedidos')}>
        <ArrowLeft data-icon="inline-start" />
        Voltar aos pedidos
      </Button>

      <FinancialNavigation />

      {(currentUserQuery.isPending || orderQuery.isPending) && (
        <p role="status" className="py-16 text-center text-muted-foreground">
          Carregando pedido...
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

      {order && (
        <>
          <div className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Pedido #{order.number}</h1>
              <p className="mt-2 text-muted-foreground">
                Pedido de {order.client.name}, originado do orçamento #{order.quote.number}.
              </p>
            </div>

            <div className="text-right">
              <span
                className={cn(
                  'w-fit rounded-full px-2.5 py-1 text-xs font-medium',
                  orderStatusClassNames[order.status],
                )}
              >
                {order.currentStage.name}
              </span>
            </div>
          </div>

          {canManage && canTransition && (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Ações do pedido</CardTitle>
                <CardDescription>
                  Avance o pedido conforme as etapas configuradas no fluxo selecionado.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={() => handleLifecycleAction('advance')}
                    disabled={lifecycleMutation.isPending}
                  >
                    {lifecycleMutation.isPending ? 'Atualizando...' : 'Avançar etapa'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleLifecycleAction('cancel')}
                    disabled={lifecycleMutation.isPending}
                  >
                    {lifecycleMutation.isPending ? 'Atualizando...' : 'Cancelar pedido'}
                  </Button>
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
              Você possui acesso somente para consulta deste pedido.
            </p>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <Card>
              <CardHeader>
                <CardTitle>Itens do pedido</CardTitle>
                <CardDescription>
                  Valores preservados quando o orçamento foi convertido em pedido.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <caption className="sr-only">Itens do pedido #{order.number}</caption>
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
                      {order.items.map((item) => (
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

                {order.notes && (
                  <div className="mt-6 rounded-lg border p-4">
                    <h2 className="text-sm font-medium">Observações</h2>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {order.notes}
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
                      <dd className="text-right font-medium">{order.client.name}</dd>
                    </div>

                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Orçamento de origem</dt>
                      <dd>
                        <button
                          type="button"
                          className="font-medium text-primary hover:underline"
                          onClick={() => navigate(`/app/financeiro/orcamentos/${order.quote.id}`)}
                        >
                          #{order.quote.number}
                        </button>
                      </dd>
                    </div>

                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Subtotal</dt>
                      <dd className="tabular-nums">{formatCurrency(order.subtotal)}</dd>
                    </div>

                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Desconto</dt>
                      <dd className="tabular-nums">{formatCurrency(order.discount)}</dd>
                    </div>

                    <div className="flex justify-between gap-4 border-t pt-3 text-base">
                      <dt className="font-medium">Total</dt>
                      <dd className="font-semibold tabular-nums">{formatCurrency(order.total)}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Andamento</CardTitle>
                </CardHeader>

                <CardContent className="space-y-5 text-sm">
                  <div className="space-y-3">
                    <p>
                      <span className="text-muted-foreground">Etapa atual: </span>
                      {order.currentStage.name}
                    </p>

                    <p>
                      <span className="text-muted-foreground">Criado em: </span>
                      {formatDate(order.createdAt)}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-medium">Histórico de etapas</h3>

                    <ol className="mt-3 space-y-3 border-l pl-4">
                      {order.stageTransitions.map((transition) => (
                        <li key={transition.id}>
                          <p>{getTransitionDescription(transition)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDate(transition.createdAt)}
                            {transition.actor && ` · ${transition.actor.name}`}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
