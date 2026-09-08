import { AlertTriangle, ArrowDown, ArrowUp, PackageSearch } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { type StockMovement } from './inventory-api';
import { useStockBalanceQuery } from './use-stock-balance-query';
import { useStockMovementsQuery } from './use-stock-movements-query';
import { StockMovementActions } from './stock-movement-actions';
import { StockAdjustmentActions } from './stock-adjustment-actions';
import { StockMovementReversalActions } from './stock-movement-reversal-actions';

interface ProductInventoryProps {
  productId: string;
  unit: string;
  canManage: boolean;
  isActive: boolean;
}

function formatQuantity(value: string, unit: string) {
  return `${new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 6,
  }).format(Number(value))} ${unit}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function movementLabel(movement: StockMovement) {
  if (movement.origin === 'ADJUSTMENT') {
    return 'Ajuste físico';
  }

  if (movement.origin === 'REVERSAL') {
    return 'Estorno';
  }

  return movement.type === 'IN' ? 'Entrada manual' : 'Saída manual';
}

export function ProductInventory({ productId, unit, canManage, isActive }: ProductInventoryProps) {
  const balanceQuery = useStockBalanceQuery(productId);
  const movementsQuery = useStockMovementsQuery(productId);

  if (balanceQuery.isPending || movementsQuery.isPending) {
    return (
      <Card className="mt-6">
        <CardContent className="py-10">
          <p role="status" className="text-sm text-muted-foreground">
            Carregando estoque...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (balanceQuery.isError || movementsQuery.isError || !balanceQuery.data) {
    const message =
      balanceQuery.error?.message ??
      movementsQuery.error?.message ??
      'Não foi possível carregar o estoque deste produto.';

    return (
      <Card className="mt-6 border-destructive/20">
        <CardContent className="py-6">
          <p role="alert" className="text-sm text-destructive">
            {message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const balance = balanceQuery.data;
  const movements = movementsQuery.data?.data ?? [];
  const total = movementsQuery.data?.pagination.total ?? 0;

  const reversedMovementIds = new Set(
    movements.flatMap((movement) =>
      movement.origin === 'REVERSAL' && movement.reversalOfId ? [movement.reversalOfId] : [],
    ),
  );

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="mb-3 grid size-10 place-items-center rounded-xl bg-primary/10">
            <PackageSearch className="size-5 text-primary" />
          </div>
          <CardTitle>Estoque</CardTitle>
          <CardDescription>
            Saldo calculado a partir do histórico imutável de movimentações.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {balance.isBelowMinimum ? (
            <div className="mb-5 flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>O saldo atual está abaixo do estoque mínimo configurado para este produto.</p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Saldo atual</p>
              <p className="mt-1 text-xl font-semibold">{formatQuantity(balance.balance, unit)}</p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <ArrowUp className="size-4 text-emerald-600" />
                Entradas
              </p>
              <p className="mt-1 text-xl font-semibold text-emerald-700 dark:text-emerald-400">
                {formatQuantity(balance.totalIn, unit)}
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <ArrowDown className="size-4 text-destructive" />
                Saídas
              </p>
              <p className="mt-1 text-xl font-semibold text-destructive">
                {formatQuantity(balance.totalOut, unit)}
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Estoque mínimo</p>
              <p className="mt-1 text-xl font-semibold">
                {balance.minimumStock ? formatQuantity(balance.minimumStock, unit) : 'Não definido'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <StockMovementActions
        productId={productId}
        balance={balance.balance}
        canManage={canManage}
        isActive={isActive}
      />

      <StockAdjustmentActions
        productId={productId}
        balance={balance.balance}
        unit={unit}
        canManage={canManage}
        isActive={isActive}
      />

      <Card>
        <CardHeader>
          <CardTitle>Histórico de movimentações</CardTitle>
          <CardDescription>
            {total === 1 ? '1 movimentação registrada.' : `${total} movimentações registradas.`}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {movements.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma movimentação de estoque foi registrada.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-medium">Data</th>
                    <th className="px-3 py-3 font-medium">Movimentação</th>
                    <th className="px-3 py-3 font-medium">Motivo</th>
                    <th className="px-3 py-3 text-right font-medium">Quantidade</th>
                    <th className="px-3 py-3 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id} className="border-b last:border-0">
                      <td className="px-3 py-3 text-muted-foreground">
                        {formatDate(movement.occurredAt)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={
                            movement.type === 'IN'
                              ? 'font-medium text-emerald-700 dark:text-emerald-400'
                              : 'font-medium text-destructive'
                          }
                        >
                          {movement.type === 'IN' ? 'Entrada' : 'Saída'}
                        </span>
                        <span className="ml-2 text-muted-foreground">
                          {movementLabel(movement)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <p>{movement.reason}</p>
                        {movement.notes ? (
                          <p className="mt-1 text-xs text-muted-foreground">{movement.notes}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-right font-medium">
                        {formatQuantity(movement.quantity, unit)}
                      </td>
                      <td className="px-3 py-3 text-right align-top">
                        <StockMovementReversalActions
                          productId={productId}
                          movement={movement}
                          canManage={canManage}
                          isReversed={reversedMovementIds.has(movement.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
