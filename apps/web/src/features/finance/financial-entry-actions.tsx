import { Ban, Copy } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { FinancialEntry, FinancialEntryStatus } from './financial-entries-api';
import { useCancelFinancialEntryMutation } from './use-cancel-financial-entry-mutation';
import { useDuplicateFinancialEntryMutation } from './use-duplicate-financial-entry-mutation';

interface FinancialEntryActionsProps {
  entry: FinancialEntry;
  currentStatus: FinancialEntryStatus;
  settledAmount: string;
  canManage: boolean;
}

export function FinancialEntryActions({
  entry,
  currentStatus,
  settledAmount,
  canManage,
}: FinancialEntryActionsProps) {
  const navigate = useNavigate();

  const [isCancelling, setIsCancelling] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationError, setCancellationError] = useState<string>();
  const [isConfirmingDuplicate, setIsConfirmingDuplicate] = useState(false);

  const cancelMutation = useCancelFinancialEntryMutation();
  const duplicateMutation = useDuplicateFinancialEntryMutation();

  const canCancel =
    canManage &&
    entry.period.status === 'OPEN' &&
    currentStatus !== 'CANCELLED' &&
    settledAmount === '0.00';

  const canDuplicate =
    canManage &&
    entry.period.status === 'OPEN' &&
    currentStatus !== 'CANCELLED' &&
    entry.category.type === 'FIXED_EXPENSE';

  if (!canCancel && !canDuplicate) {
    return null;
  }

  function closeCancellation() {
    setIsCancelling(false);
    setCancellationReason('');
    setCancellationError(undefined);
    cancelMutation.reset();
  }

  function handleCancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const reason = cancellationReason.trim();

    if (reason.length < 3) {
      setCancellationError('Informe um motivo com pelo menos 3 caracteres.');
      return;
    }

    if (reason.length > 255) {
      setCancellationError('O motivo deve ter no máximo 255 caracteres.');
      return;
    }

    setCancellationError(undefined);
    cancelMutation.reset();

    cancelMutation.mutate(
      {
        entryId: entry.id,
        input: {
          reason,
        },
      },
      {
        onSuccess: closeCancellation,
      },
    );
  }

  function closeDuplication() {
    setIsConfirmingDuplicate(false);
    duplicateMutation.reset();
  }

  function handleDuplicate() {
    duplicateMutation.reset();

    duplicateMutation.mutate(entry.id, {
      onSuccess: (duplicatedEntry) => {
        navigate(`/app/financeiro/lancamentos/${duplicatedEntry.id}`, {
          replace: true,
        });
      },
    });
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Ações do lançamento</CardTitle>
        <CardDescription>
          As ações disponíveis respeitam a situação da competência e das baixas.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {!isCancelling && !isConfirmingDuplicate && (
          <div className="flex flex-wrap gap-2">
            {canDuplicate && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsConfirmingDuplicate(true);
                  duplicateMutation.reset();
                }}
              >
                <Copy data-icon="inline-start" />
                Duplicar para o próximo mês
              </Button>
            )}

            {canCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCancelling(true);
                  setCancellationError(undefined);
                  cancelMutation.reset();
                }}
              >
                <Ban data-icon="inline-start" />
                Cancelar lançamento
              </Button>
            )}
          </div>
        )}

        {isCancelling && (
          <form className="space-y-4" onSubmit={handleCancel} noValidate>
            <div className="space-y-2">
              <label htmlFor="entry-cancellation-reason" className="text-sm font-medium">
                Motivo do cancelamento
              </label>
              <Input
                id="entry-cancellation-reason"
                value={cancellationReason}
                maxLength={255}
                onChange={(event) => setCancellationReason(event.target.value)}
                aria-invalid={Boolean(cancellationError)}
                placeholder="Explique por que o lançamento será cancelado"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              O lançamento continuará no histórico, mas deixará de participar dos cálculos
              financeiros.
            </p>

            {cancellationError && (
              <p role="alert" className="text-sm text-destructive">
                {cancellationError}
              </p>
            )}

            {cancelMutation.isError && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {cancelMutation.error.message}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={closeCancellation}
                disabled={cancelMutation.isPending}
              >
                Manter lançamento
              </Button>

              <Button type="submit" variant="destructive" disabled={cancelMutation.isPending}>
                {cancelMutation.isPending ? 'Cancelando...' : 'Confirmar cancelamento'}
              </Button>
            </div>
          </form>
        )}

        {isConfirmingDuplicate && (
          <div className="space-y-4">
            <div>
              <p className="font-medium">Duplicar este custo fixo?</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Será criado um novo lançamento na competência seguinte, mantendo descrição, valor,
                categoria, cliente e observações.
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              A competência do próximo mês precisa existir e estar aberta. Datas no último dia do
              mês serão ajustadas quando necessário.
            </p>

            {duplicateMutation.isError && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {duplicateMutation.error.message}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={closeDuplication}
                disabled={duplicateMutation.isPending}
              >
                Não duplicar
              </Button>

              <Button
                type="button"
                onClick={handleDuplicate}
                disabled={duplicateMutation.isPending}
              >
                {duplicateMutation.isPending ? 'Duplicando...' : 'Confirmar duplicação'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
