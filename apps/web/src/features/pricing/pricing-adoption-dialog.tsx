import { Dialog } from '@base-ui/react/dialog';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';

import { formatBrl } from './format-pricing';
import type { PricingVersionList } from './pricing-versions-contracts';
import { usePricingAdoptionMutation } from './use-pricing-adoption-mutation';

type Version = PricingVersionList['data'][number];

function adoptionError(error: Error): string {
  if (!(error instanceof ApiError)) {
    return 'Não foi possível confirmar o resultado da operação. Consulte o preço atual ou tente novamente; repetir o mesmo estado é idempotente no servidor.';
  }
  switch (error.code) {
    case 'BELOW_MINIMUM_FORBIDDEN':
      return 'Seu papel não permite adotar preço abaixo do mínimo desta versão.';
    case 'JUSTIFICATION_REQUIRED':
      return 'Confirme a adoção abaixo do mínimo e informe uma justificativa.';
    case 'PRICE_OUT_OF_RANGE':
      return 'O preço analisado desta versão não cabe no campo comercial do produto.';
    case 'PRICING_CONCURRENT_MODIFICATION':
      return 'O preço mudou simultaneamente. Consulte o estado atual antes de tentar novamente.';
    case 'PRICING_VERSION_NOT_FOUND':
    case 'PRICING_VERSION_NOT_FINALIZED':
      return 'A versão não está disponível para adoção. Atualize o histórico.';
    case 'PRODUCT_NOT_FOUND':
      return 'Produto não encontrado.';
    case 'PRICING_FORBIDDEN':
    case 'AUTHENTICATION_REQUIRED':
      return 'Você não tem permissão para adotar esta versão.';
    default:
      return error.status >= 500
        ? 'Não foi possível confirmar a adoção. Consulte o preço atual antes de tentar novamente.'
        : error.message;
  }
}

export function PricingAdoptionDialog({
  productId,
  version,
  canAdopt,
  canAdoptBelowMinimum,
  onClose,
  onPriceMayHaveChanged,
}: {
  productId: string;
  version: Version;
  canAdopt: boolean;
  canAdoptBelowMinimum: boolean;
  onClose: () => void;
  onPriceMayHaveChanged: () => void;
}) {
  const mutation = usePricingAdoptionMutation(productId);
  const [confirmed, setConfirmed] = useState(false);
  const [justification, setJustification] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [success, setSuccess] = useState(false);
  const submitting = useRef(false);
  const active = useRef(true);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const belowMinimum = version.classification === 'BELOW_MINIMUM';
  const requiresBelowMinimumEvidence = belowMinimum && !version.isAdopted;
  const eligiblePrice = /^(?:0|[1-9]\d{0,11})\.\d{2}$/.test(version.analyzedPrice);
  const outcomeUnknown =
    mutation.isError &&
    mutation.error !== null &&
    (!(mutation.error instanceof ApiError) || mutation.error.status >= 500);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  async function submit() {
    if (submitting.current || mutation.isPending || success || !canAdopt || !eligiblePrice) return;
    if (belowMinimum && !canAdoptBelowMinimum) return;
    if (requiresBelowMinimumEvidence && (!confirmed || justification.trim() === '')) {
      setFieldError('Confirme a adoção e informe uma justificativa.');
      return;
    }
    submitting.current = true;
    setFieldError('');
    mutation.reset();
    try {
      await mutation.mutateAsync(
        requiresBelowMinimumEvidence
          ? {
              versionId: version.id,
              belowMinimumConfirmed: true,
              justification: justification.trim(),
            }
          : { versionId: version.id },
      );
      if (!active.current) return;
      mutation.reset();
      setJustification('');
      setConfirmed(false);
      setSuccess(true);
      onPriceMayHaveChanged();
    } catch (error) {
      // A network failure, invalid 2xx response or server error may follow a commit.
      if (active.current && (!(error instanceof ApiError) || error.status >= 500)) {
        onPriceMayHaveChanged();
      }
    } finally {
      submitting.current = false;
    }
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending && !submitting.current) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/45" />
        <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
          <Dialog.Popup
            initialFocus={cancelRef}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto break-words rounded-xl bg-background p-6 shadow-xl outline-none"
          >
            <Dialog.Title className="text-lg font-semibold">
              Adotar versão {version.number}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              Esta operação altera o preço comercial atual do produto para{' '}
              {formatBrl(version.analyzedPrice)}. A decisão usa a análise congelada desta versão.
            </Dialog.Description>
            <p className="mt-4">
              Preço analisado: {formatBrl(version.analyzedPrice)}. Mínimo comercial:{' '}
              {formatBrl(version.minimumPriceCommercial)}.
            </p>
            {!eligiblePrice && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                Esta versão não possui preço analisado representável no campo comercial do produto.
                Gere uma nova versão com preço elegível.
              </p>
            )}
            {version.isAdopted && (
              <p className="mt-3 text-sm">
                Esta versão já consta como origem do preço atual. Repetir a solicitação verifica o
                estado no servidor; uma transição nova continua sujeita às confirmações exigidas.
              </p>
            )}
            {belowMinimum && !canAdoptBelowMinimum && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                Apenas OWNER e ADMIN podem adotar preço abaixo do mínimo.
              </p>
            )}
            {requiresBelowMinimumEvidence && canAdoptBelowMinimum && (
              <div className="mt-4 space-y-3">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    disabled={mutation.isPending}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  Confirmo explicitamente a adoção abaixo do mínimo comercial.
                </label>
                <div className="space-y-2">
                  <Label htmlFor="pricing-adoption-justification">Justificativa</Label>
                  <Input
                    id="pricing-adoption-justification"
                    value={justification}
                    disabled={mutation.isPending}
                    aria-invalid={Boolean(fieldError)}
                    aria-describedby={fieldError ? 'pricing-adoption-field-error' : undefined}
                    onChange={(event) => setJustification(event.target.value)}
                  />
                </div>
              </div>
            )}
            {fieldError && (
              <p id="pricing-adoption-field-error" role="alert" className="mt-3 text-destructive">
                {fieldError}
              </p>
            )}
            {mutation.isError && mutation.error && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {adoptionError(mutation.error)}
              </p>
            )}
            {success && (
              <p role="status" className="mt-3 text-sm">
                O servidor confirmou que o preço atual está vinculado à versão {version.number}.
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              {outcomeUnknown && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void mutation.verify();
                    onClose();
                  }}
                >
                  Verificar preço atual
                </Button>
              )}
              <Button
                ref={cancelRef}
                type="button"
                variant="outline"
                disabled={mutation.isPending}
                onClick={onClose}
              >
                {success ? 'Fechar' : 'Cancelar'}
              </Button>
              {!success && canAdopt && (!belowMinimum || canAdoptBelowMinimum) && (
                <Button
                  type="button"
                  disabled={!eligiblePrice || mutation.isPending}
                  onClick={() => void submit()}
                >
                  {mutation.isPending ? 'Confirmando...' : 'Confirmar adoção'}
                </Button>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
