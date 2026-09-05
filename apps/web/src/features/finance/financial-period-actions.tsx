import { LockKeyhole, LockKeyholeOpen } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { FinancialPeriod } from './finance-api';
import { useCloseFinancialPeriodMutation } from './use-close-financial-period-mutation';
import { useReopenFinancialPeriodMutation } from './use-reopen-financial-period-mutation';

type OrganizationRole = 'OWNER' | 'ADMIN' | 'FINANCE' | 'OPERATIONS' | 'VIEWER';

interface FinancialPeriodActionsProps {
  period: FinancialPeriod;
  role: OrganizationRole;
}

export function FinancialPeriodActions({ period, role }: FinancialPeriodActionsProps) {
  const [confirmation, setConfirmation] = useState<'CLOSE' | 'REOPEN'>();

  const closeMutation = useCloseFinancialPeriodMutation();
  const reopenMutation = useReopenFinancialPeriodMutation();

  const canClose =
    period.status === 'OPEN' && (role === 'OWNER' || role === 'ADMIN' || role === 'FINANCE');

  const canReopen = period.status === 'CLOSED' && (role === 'OWNER' || role === 'ADMIN');

  if (!canClose && !canReopen) {
    return null;
  }

  function cancelConfirmation() {
    setConfirmation(undefined);
    closeMutation.reset();
    reopenMutation.reset();
  }

  function handleClose() {
    closeMutation.reset();

    closeMutation.mutate(period.id, {
      onSuccess: cancelConfirmation,
    });
  }

  function handleReopen() {
    reopenMutation.reset();

    reopenMutation.mutate(period.id, {
      onSuccess: cancelConfirmation,
    });
  }

  if (!confirmation) {
    return (
      <div className="mt-4 flex justify-end">
        {canClose && (
          <Button type="button" variant="outline" onClick={() => setConfirmation('CLOSE')}>
            <LockKeyhole data-icon="inline-start" />
            Fechar competência
          </Button>
        )}

        {canReopen && (
          <Button type="button" variant="outline" onClick={() => setConfirmation('REOPEN')}>
            <LockKeyholeOpen data-icon="inline-start" />
            Reabrir competência
          </Button>
        )}
      </div>
    );
  }

  const isClosing = confirmation === 'CLOSE';
  const mutation = isClosing ? closeMutation : reopenMutation;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>
          {isClosing ? 'Fechar esta competência?' : 'Reabrir esta competência?'}
        </CardTitle>

        <CardDescription>
          {isClosing
            ? 'O mês será encerrado e seus lançamentos não poderão ser criados, editados, cancelados ou duplicados.'
            : 'O mês voltará a aceitar alterações nos lançamentos e na configuração financeira.'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {isClosing && (
          <p className="text-sm text-muted-foreground">
            Baixas e estornos continuarão permitidos mesmo depois do fechamento.
          </p>
        )}

        {mutation.isError && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {mutation.error.message}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={cancelConfirmation}
            disabled={mutation.isPending}
          >
            Voltar
          </Button>

          <Button
            type="button"
            variant={isClosing ? 'destructive' : 'default'}
            onClick={isClosing ? handleClose : handleReopen}
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? isClosing
                ? 'Fechando...'
                : 'Reabrindo...'
              : isClosing
                ? 'Confirmar fechamento'
                : 'Confirmar reabertura'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
