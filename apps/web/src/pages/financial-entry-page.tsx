import { ArrowLeft, BadgeDollarSign, Plus, ReceiptText } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import { FinancialNavigation } from '@/features/finance/financial-navigation';
import { useCreateFinancialSettlementMutation } from '@/features/finance/use-create-financial-settlement-mutation';
import { useFinancialAccountsQuery } from '@/features/finance/use-financial-accounts-query';
import { useFinancialEntryQuery } from '@/features/finance/use-financial-entry-query';
import { useFinancialSettlementsQuery } from '@/features/finance/use-financial-settlements-query';
import { useReverseFinancialSettlementMutation } from '@/features/finance/use-reverse-financial-settlement-mutation';
import { FinancialEntryActions } from '@/features/finance/financial-entry-actions';
import { FinancialEntryEditForm } from '@/features/finance/financial-entry-edit-form';
import { cn } from '@/lib/utils';

const moneyPattern = /^(?=.*[1-9])\d{1,12}(?:\.\d{1,2})?$/;

const statusLabels = {
  PENDING: 'Pendente',
  PARTIAL: 'Parcial',
  SETTLED: 'Liquidado',
  CANCELLED: 'Cancelado',
} as const;

const categoryTypeLabels = {
  REVENUE: 'Receita',
  FIXED_EXPENSE: 'Custo fixo',
  VARIABLE_EXPENSE: 'Custo variável',
} as const;

function getLocalDate(): string {
  const today = new Date();

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-');

  return `${day}/${month}/${year}`;
}

function formatCurrency(value: string): string {
  const isNegative = value.startsWith('-');
  const absoluteValue = isNegative ? value.slice(1) : value;
  const [integerPart, decimalPart = '00'] = absoluteValue.split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${isNegative ? '-' : ''}R$ ${formattedInteger},${decimalPart}`;
}

function moneyToMinorUnits(value: string): bigint {
  const [integerPart, decimalPart = ''] = value.split('.');

  return BigInt(integerPart) * 100n + BigInt(decimalPart.padEnd(2, '0').slice(0, 2));
}

export function FinancialEntryPage() {
  const navigate = useNavigate();
  const { entryId } = useParams<{ entryId: string }>();

  const [isCreatingSettlement, setIsCreatingSettlement] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [settledAt, setSettledAt] = useState(getLocalDate);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string>();
  const [reversingSettlementId, setReversingSettlementId] = useState<string>();
  const [reversalReason, setReversalReason] = useState('');
  const [reversalError, setReversalError] = useState<string>();

  const currentUserQuery = useCurrentUserQuery();
  const entryQuery = useFinancialEntryQuery(entryId);
  const settlementsQuery = useFinancialSettlementsQuery(entryId);
  const accountsQuery = useFinancialAccountsQuery({
    isActive: true,
  });
  const createSettlementMutation = useCreateFinancialSettlementMutation();

  const reverseSettlementMutation = useReverseFinancialSettlementMutation();

  const role = currentUserQuery.data?.organization.role;
  const canManage = role === 'OWNER' || role === 'ADMIN' || role === 'FINANCE';

  const entry = entryQuery.data;
  const settlementResponse = settlementsQuery.data;
  const accounts = accountsQuery.data ?? [];

  const currentStatus = settlementResponse?.entry.status ?? entry?.status;
  const remainingAmount = settlementResponse?.entry.remainingAmount ?? entry?.amount;
  const settledAmount = settlementResponse?.entry.settledAmount ?? '0.00';

  const canCreateSettlement =
    canManage &&
    currentStatus !== 'CANCELLED' &&
    remainingAmount !== undefined &&
    remainingAmount !== '0.00';

  function openSettlementForm() {
    setAccountId('');
    setAmount(remainingAmount ?? '');
    setSettledAt(getLocalDate());
    setNotes('');
    setFormError(undefined);
    createSettlementMutation.reset();
    setIsCreatingSettlement(true);
  }

  function closeSettlementForm() {
    setIsCreatingSettlement(false);
    setFormError(undefined);
    createSettlementMutation.reset();
  }

  function handleCreateSettlement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!entryId || !remainingAmount) {
      return;
    }

    if (!accountId) {
      setFormError('Selecione uma conta financeira.');
      return;
    }

    const normalizedAmount = amount.trim();

    if (!moneyPattern.test(normalizedAmount)) {
      setFormError('Informe um valor positivo com até duas casas decimais.');
      return;
    }

    if (moneyToMinorUnits(normalizedAmount) > moneyToMinorUnits(remainingAmount)) {
      setFormError('O valor da baixa não pode ultrapassar o saldo restante.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(settledAt)) {
      setFormError('Informe a data da baixa.');
      return;
    }

    setFormError(undefined);
    createSettlementMutation.reset();

    createSettlementMutation.mutate(
      {
        entryId,
        input: {
          accountId,
          amount: normalizedAmount,
          settledAt,
          notes: notes.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          closeSettlementForm();
        },
      },
    );
  }

  function beginReversingSettlement(settlementId: string) {
    setReversingSettlementId(settlementId);
    setReversalReason('');
    setReversalError(undefined);
    reverseSettlementMutation.reset();
  }

  function cancelReversingSettlement() {
    setReversingSettlementId(undefined);
    setReversalReason('');
    setReversalError(undefined);
    reverseSettlementMutation.reset();
  }

  function handleReverseSettlement(event: FormEvent<HTMLFormElement>, settlementId: string) {
    event.preventDefault();

    const reason = reversalReason.trim();

    if (reason.length < 3) {
      setReversalError('Informe um motivo com pelo menos 3 caracteres.');
      return;
    }

    if (reason.length > 255) {
      setReversalError('O motivo deve ter no máximo 255 caracteres.');
      return;
    }

    setReversalError(undefined);
    reverseSettlementMutation.reset();

    reverseSettlementMutation.mutate(
      {
        settlementId,
        input: {
          reason,
        },
      },
      {
        onSuccess: cancelReversingSettlement,
      },
    );
  }

  const pageError = entryQuery.error ?? settlementsQuery.error;
  const isPageLoading = entryQuery.isPending || settlementsQuery.isPending;

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate('/app/financeiro/lancamentos')}
        >
          <ArrowLeft data-icon="inline-start" />
          Voltar aos lançamentos
        </Button>
      </div>

      <FinancialNavigation />

      {isPageLoading && (
        <p role="status" className="py-16 text-center text-muted-foreground">
          Carregando lançamento financeiro...
        </p>
      )}

      {pageError && (
        <p
          role="alert"
          className="mt-8 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {pageError.message}
        </p>
      )}

      {entry && settlementResponse && (
        <>
          <div className="mt-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight">{entry.description}</h1>

                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium',
                    currentStatus === 'PENDING' && 'bg-amber-100 text-amber-800',
                    currentStatus === 'PARTIAL' && 'bg-blue-100 text-blue-800',
                    currentStatus === 'SETTLED' && 'bg-emerald-100 text-emerald-800',
                    currentStatus === 'CANCELLED' && 'bg-zinc-200 text-zinc-700',
                  )}
                >
                  {currentStatus ? statusLabels[currentStatus] : entry.status}
                </span>
              </div>

              <p className="mt-2 text-muted-foreground">
                {entry.category.name} · {categoryTypeLabels[entry.category.type]} · vencimento em{' '}
                {formatDate(entry.dueDate)}
              </p>
            </div>

            {canCreateSettlement && (
              <Button
                type="button"
                onClick={isCreatingSettlement ? closeSettlementForm : openSettlementForm}
              >
                <Plus data-icon="inline-start" />
                {isCreatingSettlement ? 'Fechar formulário' : 'Registrar baixa'}
              </Button>
            )}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardDescription>Valor do lançamento</CardDescription>
                <CardTitle className="text-2xl">
                  {formatCurrency(settlementResponse.entry.amount)}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Valor baixado</CardDescription>
                <CardTitle className="text-2xl text-emerald-700">
                  {formatCurrency(settledAmount)}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Saldo restante</CardDescription>
                <CardTitle className="text-2xl">
                  {formatCurrency(remainingAmount ?? '0.00')}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <FinancialEntryActions
            entry={entry}
            currentStatus={settlementResponse.entry.status}
            settledAmount={settlementResponse.entry.settledAmount}
            canManage={canManage}
          />

          <FinancialEntryEditForm
            entry={entry}
            settledAmount={settlementResponse.entry.settledAmount}
            canManage={canManage}
          />

          {isCreatingSettlement && canCreateSettlement && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Registrar baixa</CardTitle>
                <CardDescription>
                  Informe onde e quando o valor foi recebido ou pago.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form className="space-y-5" onSubmit={handleCreateSettlement} noValidate>
                  <div className="grid gap-5 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="settlement-account">Conta financeira</Label>
                      <select
                        id="settlement-account"
                        value={accountId}
                        onChange={(event) => setAccountId(event.target.value)}
                        className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <option value="">Selecione</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="settlement-amount">Valor</Label>
                      <Input
                        id="settlement-amount"
                        type="text"
                        inputMode="decimal"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="settlement-date">Data da baixa</Label>
                      <Input
                        id="settlement-date"
                        type="date"
                        value={settledAt}
                        onChange={(event) => setSettledAt(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="settlement-notes">Observações</Label>
                    <textarea
                      id="settlement-notes"
                      rows={3}
                      maxLength={2000}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  </div>

                  {accountsQuery.isError && (
                    <p role="alert" className="text-sm text-destructive">
                      {accountsQuery.error.message}
                    </p>
                  )}

                  {accountsQuery.isSuccess && accounts.length === 0 && (
                    <p role="alert" className="text-sm text-destructive">
                      Cadastre uma conta financeira ativa antes de registrar a baixa.
                    </p>
                  )}

                  {formError && (
                    <p role="alert" className="text-sm text-destructive">
                      {formError}
                    </p>
                  )}

                  {createSettlementMutation.isError && (
                    <p
                      role="alert"
                      className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
                    >
                      {createSettlementMutation.error.message}
                    </p>
                  )}

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeSettlementForm}
                      disabled={createSettlementMutation.isPending}
                    >
                      Cancelar
                    </Button>

                    <Button
                      type="submit"
                      disabled={createSettlementMutation.isPending || accounts.length === 0}
                    >
                      {createSettlementMutation.isPending ? 'Registrando...' : 'Confirmar baixa'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <Card>
              <CardHeader>
                <CardTitle>Detalhes</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Competência</p>
                  <p className="mt-1 font-medium">
                    {String(entry.period.month).padStart(2, '0')}/{entry.period.year}
                  </p>
                </div>

                <div>
                  <p className="text-muted-foreground">Categoria</p>
                  <p className="mt-1 font-medium">{entry.category.name}</p>
                </div>

                <div>
                  <p className="text-muted-foreground">Cliente</p>
                  <p className="mt-1 font-medium">{entry.client?.name ?? 'Não informado'}</p>
                </div>

                <div>
                  <p className="text-muted-foreground">Observações</p>
                  <p className="mt-1 whitespace-pre-wrap font-medium">
                    {entry.notes ?? 'Não informadas'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-primary/10">
                    <ReceiptText className="size-5 text-primary" />
                  </div>

                  <div>
                    <CardTitle>Histórico de baixas</CardTitle>
                    <CardDescription>Baixas ativas e estornadas deste lançamento.</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {settlementResponse.data.length === 0 ? (
                  <div className="py-10 text-center">
                    <BadgeDollarSign className="mx-auto size-10 text-muted-foreground" />
                    <p className="mt-3 font-medium">Nenhuma baixa registrada</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {settlementResponse.data.map((settlement) => (
                      <div
                        key={settlement.id}
                        className={cn(
                          'rounded-lg border p-4',
                          settlement.reversedAt && 'bg-muted/50',
                        )}
                      >
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p
                                className={cn(
                                  'font-medium',
                                  settlement.reversedAt && 'text-muted-foreground line-through',
                                )}
                              >
                                {formatCurrency(settlement.amount)}
                              </p>

                              {settlement.reversedAt && (
                                <span className="rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700">
                                  Estornada
                                </span>
                              )}
                            </div>

                            <p className="mt-1 text-sm text-muted-foreground">
                              {settlement.account.name}
                            </p>
                          </div>

                          <p className="text-sm text-muted-foreground">
                            {formatDate(settlement.settledAt)}
                          </p>
                        </div>

                        {settlement.notes && (
                          <p className="mt-3 whitespace-pre-wrap text-sm">{settlement.notes}</p>
                        )}

                        {settlement.reversalReason && (
                          <p className="mt-3 text-sm text-destructive">
                            Motivo do estorno: {settlement.reversalReason}
                          </p>
                        )}

                        {!settlement.reversedAt && canManage && (
                          <>
                            {reversingSettlementId === settlement.id ? (
                              <form
                                className="mt-4 space-y-3 border-t pt-4"
                                onSubmit={(event) => handleReverseSettlement(event, settlement.id)}
                                noValidate
                              >
                                <div className="space-y-2">
                                  <Label htmlFor={`reversal-reason-${settlement.id}`}>
                                    Motivo do estorno
                                  </Label>
                                  <Input
                                    id={`reversal-reason-${settlement.id}`}
                                    value={reversalReason}
                                    maxLength={255}
                                    onChange={(event) => setReversalReason(event.target.value)}
                                    aria-invalid={Boolean(reversalError)}
                                    placeholder="Explique por que esta baixa será estornada"
                                  />
                                </div>

                                {reversalError && (
                                  <p role="alert" className="text-sm text-destructive">
                                    {reversalError}
                                  </p>
                                )}

                                {reverseSettlementMutation.isError && (
                                  <p
                                    role="alert"
                                    className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
                                  >
                                    {reverseSettlementMutation.error.message}
                                  </p>
                                )}

                                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={cancelReversingSettlement}
                                    disabled={reverseSettlementMutation.isPending}
                                  >
                                    Manter baixa
                                  </Button>

                                  <Button
                                    type="submit"
                                    variant="destructive"
                                    disabled={reverseSettlementMutation.isPending}
                                  >
                                    {reverseSettlementMutation.isPending
                                      ? 'Estornando...'
                                      : 'Confirmar estorno'}
                                  </Button>
                                </div>
                              </form>
                            ) : (
                              <div className="mt-4 flex justify-end border-t pt-4">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => beginReversingSettlement(settlement.id)}
                                  disabled={reverseSettlementMutation.isPending}
                                >
                                  Estornar baixa
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
