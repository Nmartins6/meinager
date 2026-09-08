import { RotateCcw } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { type StockMovement } from './inventory-api';
import { useReverseStockMovementMutation } from './use-reverse-stock-movement-mutation';

interface StockMovementReversalActionsProps {
  productId: string;
  movement: StockMovement;
  canManage: boolean;
  isReversed: boolean;
}

export function StockMovementReversalActions({
  productId,
  movement,
  canManage,
  isReversed,
}: StockMovementReversalActionsProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string>();

  const reverseMovementMutation = useReverseStockMovementMutation();

  if (!canManage || movement.origin === 'REVERSAL') {
    return null;
  }

  if (isReversed) {
    return <span className="text-xs text-muted-foreground">Estornado</span>;
  }

  function closeForm() {
    setIsConfirming(false);
    setReason('');
    setNotes('');
    setFormError(undefined);
    reverseMovementMutation.reset();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedReason = reason.trim();
    const normalizedNotes = notes.trim();

    if (normalizedReason.length < 3) {
      setFormError('Informe um motivo com pelo menos 3 caracteres.');
      return;
    }

    if (normalizedReason.length > 255) {
      setFormError('O motivo deve ter no máximo 255 caracteres.');
      return;
    }

    setFormError(undefined);
    reverseMovementMutation.reset();

    reverseMovementMutation.mutate(
      {
        productId,
        movementId: movement.id,
        input: {
          reason: normalizedReason,
          notes: normalizedNotes || undefined,
        },
      },
      {
        onSuccess: closeForm,
      },
    );
  }

  if (!isConfirming) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setIsConfirming(true);
          setFormError(undefined);
          reverseMovementMutation.reset();
        }}
      >
        <RotateCcw data-icon="inline-start" />
        Estornar
      </Button>
    );
  }

  return (
    <form className="min-w-64 space-y-3 text-left" onSubmit={handleSubmit} noValidate>
      <div className="space-y-1.5">
        <Label htmlFor={`stock-reversal-reason-${movement.id}`}>Motivo do estorno</Label>
        <Input
          id={`stock-reversal-reason-${movement.id}`}
          maxLength={255}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explique o estorno"
          aria-invalid={Boolean(formError)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`stock-reversal-notes-${movement.id}`}>Observações do estorno</Label>
        <textarea
          id={`stock-reversal-notes-${movement.id}`}
          rows={2}
          maxLength={2000}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      {formError ? (
        <p role="alert" className="text-xs text-destructive">
          {formError}
        </p>
      ) : null}

      {reverseMovementMutation.isError ? (
        <p role="alert" className="text-xs text-destructive">
          {reverseMovementMutation.error.message}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={closeForm}
          disabled={reverseMovementMutation.isPending}
        >
          Cancelar
        </Button>

        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={reverseMovementMutation.isPending}
        >
          {reverseMovementMutation.isPending ? 'Estornando...' : 'Confirmar estorno'}
        </Button>
      </div>
    </form>
  );
}
