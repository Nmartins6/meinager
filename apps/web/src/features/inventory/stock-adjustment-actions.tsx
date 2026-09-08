import { ClipboardCheck, Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useAdjustStockMutation } from './use-adjust-stock-mutation';

const nonNegativeQuantityPattern = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/;

interface StockAdjustmentActionsProps {
  productId: string;
  balance: string;
  unit: string;
  canManage: boolean;
  isActive: boolean;
}

function formatQuantity(value: string, unit: string) {
  return `${new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 6,
  }).format(Number(value))} ${unit}`;
}

export function StockAdjustmentActions({
  productId,
  balance,
  unit,
  canManage,
  isActive,
}: StockAdjustmentActionsProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [countedQuantity, setCountedQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string>();

  const adjustStockMutation = useAdjustStockMutation();

  if (!canManage) {
    return null;
  }

  function closeForm() {
    setIsFormOpen(false);
    setCountedQuantity('');
    setReason('');
    setNotes('');
    setFormError(undefined);
    adjustStockMutation.reset();
  }

  function openForm() {
    setFormError(undefined);
    adjustStockMutation.reset();
    setIsFormOpen(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedQuantity = countedQuantity.trim();
    const normalizedReason = reason.trim();
    const normalizedNotes = notes.trim();

    if (!nonNegativeQuantityPattern.test(normalizedQuantity)) {
      setFormError(
        'Informe uma contagem não negativa, com até 12 dígitos inteiros e 6 casas decimais.',
      );
      return;
    }

    if (normalizedReason.length < 3) {
      setFormError('Informe um motivo com pelo menos 3 caracteres.');
      return;
    }

    if (normalizedReason.length > 255) {
      setFormError('O motivo deve ter no máximo 255 caracteres.');
      return;
    }

    setFormError(undefined);
    adjustStockMutation.reset();

    adjustStockMutation.mutate(
      {
        productId,
        input: {
          countedQuantity: normalizedQuantity,
          expectedBalance: balance,
          reason: normalizedReason,
          notes: normalizedNotes || undefined,
        },
      },
      {
        onSuccess: closeForm,
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ajuste por contagem física</CardTitle>
        <CardDescription>
          Informe a quantidade encontrada. O sistema registrará somente a diferença em relação ao
          saldo atual.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {!isActive ? (
          <p className="text-sm text-muted-foreground">
            Produtos inativos não podem receber ajustes de estoque.
          </p>
        ) : !isFormOpen ? (
          <Button type="button" variant="outline" onClick={openForm}>
            <ClipboardCheck data-icon="inline-start" />
            Registrar ajuste físico
          </Button>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="text-muted-foreground">Saldo usado para este ajuste</p>
              <p className="mt-1 font-medium">{formatQuantity(balance, unit)}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock-adjustment-count">Contagem física</Label>
              <Input
                id="stock-adjustment-count"
                type="text"
                inputMode="decimal"
                maxLength={19}
                value={countedQuantity}
                onChange={(event) => setCountedQuantity(event.target.value)}
                placeholder="0.000000"
                aria-invalid={Boolean(formError)}
              />
              <p className="text-xs text-muted-foreground">
                Use ponto como separador decimal. Uma contagem igual ao saldo não cria movimentação.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock-adjustment-reason">Motivo do ajuste</Label>
              <Input
                id="stock-adjustment-reason"
                maxLength={255}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ex.: Inventário mensal"
                aria-invalid={Boolean(formError)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock-adjustment-notes">Observações do ajuste</Label>
              <textarea
                id="stock-adjustment-notes"
                rows={3}
                maxLength={2000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            {formError ? (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            ) : null}

            {adjustStockMutation.isError ? (
              <p
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {adjustStockMutation.error.message}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={closeForm}
                disabled={adjustStockMutation.isPending}
              >
                Cancelar
              </Button>

              <Button type="submit" disabled={adjustStockMutation.isPending}>
                <Plus data-icon="inline-start" />
                {adjustStockMutation.isPending ? 'Ajustando...' : 'Confirmar ajuste'}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
