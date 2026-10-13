import { Dialog } from '@base-ui/react/dialog';
import { useRef, useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { canonicalizeCommercialDecimalInput } from './format-pricing';
import { manualProductPriceInputSchema } from './pricing-contracts';
import { useSetManualProductPriceMutation } from './use-set-manual-product-price-mutation';

interface ManualProductPriceDialogProps {
  productId: string;
  currentPrice: string | null;
}

export function ManualProductPriceDialog({
  productId,
  currentPrice,
}: ManualProductPriceDialogProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentPrice ?? '');
  const [validationError, setValidationError] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = useSetManualProductPriceMutation();

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && mutation.isPending) {
      return;
    }

    if (nextOpen) {
      setValue(currentPrice ?? '');
      setValidationError(undefined);
      setSuccessMessage(undefined);
      mutation.reset();
    }

    setOpen(nextOpen);
  }

  function submit(salePrice: string | null) {
    const parsed = manualProductPriceInputSchema.safeParse({ salePrice });

    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Informe um preço válido.');
      return;
    }

    setValidationError(undefined);
    setSuccessMessage(undefined);
    mutation.mutate(
      { productId, salePrice: parsed.data.salePrice },
      {
        onSuccess: () => {
          setSuccessMessage(
            parsed.data.salePrice === null ? 'Preço manual removido.' : 'Preço manual atualizado.',
          );
        },
      },
    );
  }

  function handleConfirm() {
    const normalized = canonicalizeCommercialDecimalInput(value);

    if (normalized === null || normalized === '') {
      setValidationError('Informe um preço válido ou use a ação de remover.');
      return;
    }

    submit(normalized);
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger className={buttonVariants({ variant: 'outline' })}>
        Definir preço manual
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/45" />
        <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
          <Dialog.Popup
            initialFocus={inputRef}
            className="w-full max-w-md rounded-xl bg-background p-6 shadow-xl outline-none ring-1 ring-foreground/10"
          >
            <Dialog.Title className="text-lg font-semibold">Definir preço manual</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              Confirmar um preço manual remove a origem vinculada à versão de precificação, mesmo
              quando o valor for igual ao preço atual.
            </Dialog.Description>

            <div className="mt-5 space-y-2">
              <Label htmlFor="manual-product-price">Preço de venda</Label>
              <Input
                ref={inputRef}
                id="manual-product-price"
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                aria-invalid={Boolean(validationError)}
                aria-describedby={
                  validationError
                    ? 'manual-product-price-help manual-product-price-error'
                    : 'manual-product-price-help'
                }
                aria-errormessage={validationError ? 'manual-product-price-error' : undefined}
                disabled={mutation.isPending}
              />
              <p id="manual-product-price-help" className="text-xs text-muted-foreground">
                Use ponto ou uma única vírgula como separador decimal.
              </p>
            </div>

            {validationError && (
              <p
                id="manual-product-price-error"
                role="alert"
                className="mt-3 text-sm text-destructive"
              >
                {validationError}
              </p>
            )}

            {mutation.isError && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {mutation.error.message}
              </p>
            )}

            <p aria-live="polite" className="mt-3 text-sm text-emerald-700">
              {successMessage}
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Dialog.Close
                className={buttonVariants({ variant: 'outline' })}
                disabled={mutation.isPending}
              >
                Cancelar
              </Dialog.Close>
              <Button
                type="button"
                variant="destructive"
                onClick={() => submit(null)}
                disabled={mutation.isPending}
              >
                Remover preço
              </Button>
              <Button type="button" onClick={handleConfirm} disabled={mutation.isPending}>
                {mutation.isPending ? 'Salvando...' : 'Confirmar preço'}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
