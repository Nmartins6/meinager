import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { type StockMovementType } from './inventory-api';
import { useCreateStockMovementMutation } from './use-create-stock-movement-mutation';

const quantityPattern = /^(?=.*[1-9])(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/;

interface StockMovementActionsProps {
  productId: string;
  balance: string;
  canManage: boolean;
  isActive: boolean;
}

function toMicroUnits(value: string): bigint {
  const [integerPart, decimalPart = ''] = value.split('.');

  return BigInt(integerPart) * 1_000_000n + BigInt(decimalPart.padEnd(6, '0'));
}

export function StockMovementActions({
  productId,
  balance,
  canManage,
  isActive,
}: StockMovementActionsProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [type, setType] = useState<StockMovementType>('IN');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string>();

  const createMovementMutation = useCreateStockMovementMutation();

  if (!canManage) {
    return null;
  }

  function closeForm() {
    setIsFormOpen(false);
    setType('IN');
    setQuantity('');
    setReason('');
    setNotes('');
    setFormError(undefined);
    createMovementMutation.reset();
  }

  function openForm() {
    setFormError(undefined);
    createMovementMutation.reset();
    setIsFormOpen(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedQuantity = quantity.trim();
    const normalizedReason = reason.trim();
    const normalizedNotes = notes.trim();

    if (!quantityPattern.test(normalizedQuantity)) {
      setFormError(
        'Informe uma quantidade positiva, com até 12 dígitos inteiros e 6 casas decimais.',
      );
      return;
    }

    if (type === 'OUT' && toMicroUnits(normalizedQuantity) > toMicroUnits(balance)) {
      setFormError('A quantidade da saída não pode ultrapassar o saldo atual.');
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
    createMovementMutation.reset();

    createMovementMutation.mutate(
      {
        productId,
        input: {
          type,
          quantity: normalizedQuantity,
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
        <CardTitle>Movimentar estoque</CardTitle>
        <CardDescription>
          Registre uma entrada ou saída manual. A movimentação permanecerá no histórico.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {!isActive ? (
          <p className="text-sm text-muted-foreground">
            Produtos inativos não podem receber novas movimentações.
          </p>
        ) : !isFormOpen ? (
          <Button type="button" onClick={openForm}>
            <Plus data-icon="inline-start" />
            Registrar movimentação
          </Button>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="stock-movement-type">Tipo de movimentação</Label>
                <select
                  id="stock-movement-type"
                  value={type}
                  onChange={(event) => setType(event.target.value as StockMovementType)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="IN">Entrada</option>
                  <option value="OUT">Saída</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stock-movement-quantity">Quantidade</Label>
                <Input
                  id="stock-movement-quantity"
                  type="text"
                  inputMode="decimal"
                  maxLength={19}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder="0.000000"
                  aria-invalid={Boolean(formError)}
                />
                <p className="text-xs text-muted-foreground">Use ponto como separador decimal.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock-movement-reason">Motivo</Label>
              <Input
                id="stock-movement-reason"
                maxLength={255}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ex.: Compra de fornecedor"
                aria-invalid={Boolean(formError)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock-movement-notes">Observações da movimentação</Label>
              <textarea
                id="stock-movement-notes"
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

            {createMovementMutation.isError ? (
              <p
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {createMovementMutation.error.message}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={closeForm}
                disabled={createMovementMutation.isPending}
              >
                Cancelar
              </Button>

              <Button type="submit" disabled={createMovementMutation.isPending}>
                {type === 'IN' ? (
                  <ArrowUp data-icon="inline-start" />
                ) : (
                  <ArrowDown data-icon="inline-start" />
                )}
                {createMovementMutation.isPending
                  ? 'Registrando...'
                  : type === 'IN'
                    ? 'Confirmar entrada'
                    : 'Confirmar saída'}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
