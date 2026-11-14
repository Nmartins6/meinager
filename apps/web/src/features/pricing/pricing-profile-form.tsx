import { Dialog } from '@base-ui/react/dialog';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { useBeforeUnload } from 'react-router-dom';
import { PricingDraftNavigation } from './pricing-draft-navigation';
import { usePricingDraftBlocker } from './use-pricing-draft-blocker';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';

import {
  buildCreatePricingProfileInput,
  buildUpdatePricingProfileInput,
  emptyPricingDeductionFormValue,
  pricingProfileFormSchema,
  pricingProfileToFormValues,
  type PricingProfileFormValues,
} from './pricing-profile-form-state';
import type { PricingProfileDetail } from './pricing-profiles-contracts';
import {
  useCreatePricingProfileMutation,
  useUpdatePricingProfileMutation,
} from './use-pricing-profile-mutations';

const selectClassName =
  'h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60';

type ReloadResult =
  { success: true; profile: PricingProfileDetail } | { success: false; error: string };

interface PricingProfileFormProps {
  profile: PricingProfileDetail | null;
  canEdit: boolean;
  onSaved: (profile: PricingProfileDetail) => void;
  onCancel: () => void;
  onReload?: () => Promise<ReloadResult>;
}

function cloneEmptyDeduction() {
  return structuredClone(emptyPricingDeductionFormValue);
}

export function PricingProfileForm(props: PricingProfileFormProps) {
  return (
    <PricingDraftNavigation>
      <PricingProfileFormContent {...props} />
    </PricingDraftNavigation>
  );
}

function PricingProfileFormContent({
  profile,
  canEdit,
  onSaved,
  onCancel,
  onReload,
}: PricingProfileFormProps) {
  const createMutation = useCreatePricingProfileMutation();
  const updateMutation = useUpdatePricingProfileMutation(profile?.id ?? '');
  const isPending = profile ? updateMutation.isPending : createMutation.isPending;
  const mutationError = profile ? updateMutation.error : createMutation.error;
  const isMutationError = profile ? updateMutation.isError : createMutation.isError;
  const [feedback, setFeedback] = useState<string>();
  const [hasConflict, setHasConflict] = useState(false);
  const [reloadError, setReloadError] = useState<string>();
  const [isReloading, setIsReloading] = useState(false);
  const [allowConfirmedCreateNavigation, setAllowConfirmedCreateNavigation] = useState(false);
  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
    setError,
  } = useForm<PricingProfileFormValues>({
    resolver: zodResolver(pricingProfileFormSchema),
    defaultValues: pricingProfileToFormValues(profile),
  });
  const { fields, append, remove, move } = useFieldArray({ control, name: 'deductions' });
  const shouldProtectDraft = canEdit && isDirty;
  const blocker = usePricingDraftBlocker(shouldProtectDraft && !allowConfirmedCreateNavigation);

  useBeforeUnload(
    useCallback(
      (event) => {
        if (shouldProtectDraft) {
          event.preventDefault();
          event.returnValue = '';
        }
      },
      [shouldProtectDraft],
    ),
  );

  useEffect(() => {
    reset(pricingProfileToFormValues(profile));
  }, [profile, reset]);

  function submit(values: PricingProfileFormValues) {
    createMutation.reset();
    updateMutation.reset();
    setFeedback(undefined);
    setReloadError(undefined);

    if (!profile) {
      createMutation.mutate(buildCreatePricingProfileInput(values), {
        onSuccess: (created) => {
          flushSync(() => {
            reset(pricingProfileToFormValues(created));
            setFeedback('Perfil criado com sucesso.');
            setAllowConfirmedCreateNavigation(true);
          });
          try {
            onSaved(created);
          } finally {
            setAllowConfirmedCreateNavigation(false);
          }
        },
        onError: handleMutationError,
      });
      return;
    }

    const patch = buildUpdatePricingProfileInput(values, profile);
    if (!patch.changed) {
      setFeedback('Nenhuma alteração para salvar. A revisão atual foi preservada.');
      return;
    }

    updateMutation.mutate(patch.input, {
      onSuccess: (saved) => {
        reset(pricingProfileToFormValues(saved));
        setFeedback(`Perfil salvo na revisão ${saved.currentRevision.revision}.`);
        onSaved(saved);
      },
      onError: handleMutationError,
    });
  }

  function handleMutationError(error: Error) {
    if (
      error instanceof ApiError &&
      (error.code === 'PRICING_REVISION_CONFLICT' ||
        error.code === 'PRICING_CONCURRENT_MODIFICATION')
    ) {
      setHasConflict(true);
      return;
    }
    if (error instanceof ApiError && error.field === 'name') {
      setError('name', { message: error.message });
    }
  }

  async function reloadAfterConflict() {
    if (!onReload) return;
    setIsReloading(true);
    setReloadError(undefined);
    try {
      const result = await onReload();
      if (!result.success) {
        setReloadError(result.error);
        return;
      }
      reset(pricingProfileToFormValues(result.profile));
      createMutation.reset();
      updateMutation.reset();
      setHasConflict(false);
      setFeedback('Perfil recarregado. Revise os dados antes de editar novamente.');
    } finally {
      setIsReloading(false);
    }
  }

  function cancel() {
    reset(pricingProfileToFormValues(profile));
    createMutation.reset();
    updateMutation.reset();
    setHasConflict(false);
    setReloadError(undefined);
    setFeedback(undefined);
    onCancel();
  }

  const disabled = !canEdit || isPending || hasConflict;

  return (
    <form className="space-y-6" onSubmit={handleSubmit(submit)} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>{profile ? 'Dados do perfil' : 'Novo perfil de venda'}</CardTitle>
          <CardDescription>
            As deduções são aplicadas na ordem exibida. Percentuais usam unidade humana.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Nome</Label>
            <Input
              id="profile-name"
              disabled={disabled}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'profile-name-error' : undefined}
              {...register('name')}
            />
            {errors.name && (
              <p id="profile-name-error" role="alert" className="text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-medium">Deduções</h2>
              <p className="text-sm text-muted-foreground">
                A ordem abaixo será enviada ao servidor como a ordem efetiva.
              </p>
            </div>
            {canEdit && (
              <Button
                type="button"
                variant="outline"
                onClick={() => append(cloneEmptyDeduction())}
                disabled={disabled}
              >
                <Plus data-icon="inline-start" />
                Adicionar dedução
              </Button>
            )}
          </div>

          {fields.length === 0 && (
            <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
              Este perfil não possui deduções.
            </p>
          )}

          <div className="space-y-4">
            {fields.map((field, index) => {
              const itemErrors = errors.deductions?.[index];
              return (
                <fieldset key={field.id} className="space-y-4 rounded-xl border p-4">
                  <legend className="px-2 text-sm font-semibold">Dedução {index + 1}</legend>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`deduction-${index}-name`}>Nome</Label>
                      <Input
                        id={`deduction-${index}-name`}
                        disabled={disabled}
                        aria-invalid={Boolean(itemErrors?.name)}
                        aria-describedby={
                          itemErrors?.name ? `deduction-${index}-name-error` : undefined
                        }
                        {...register(`deductions.${index}.name`)}
                      />
                      {itemErrors?.name && (
                        <p
                          id={`deduction-${index}-name-error`}
                          role="alert"
                          className="text-sm text-destructive"
                        >
                          {itemErrors.name.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`deduction-${index}-category`}>Categoria</Label>
                      <Input
                        id={`deduction-${index}-category`}
                        disabled={disabled}
                        aria-invalid={Boolean(itemErrors?.category)}
                        aria-describedby={
                          itemErrors?.category ? `deduction-${index}-category-error` : undefined
                        }
                        {...register(`deductions.${index}.category`)}
                      />
                      {itemErrors?.category && (
                        <p
                          id={`deduction-${index}-category-error`}
                          role="alert"
                          className="text-sm text-destructive"
                        >
                          {itemErrors.category.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`deduction-${index}-rate`}>Percentual</Label>
                      <Input
                        id={`deduction-${index}-rate`}
                        inputMode="decimal"
                        disabled={disabled}
                        aria-invalid={Boolean(itemErrors?.rate)}
                        aria-describedby={
                          itemErrors?.rate ? `deduction-${index}-rate-error` : undefined
                        }
                        {...register(`deductions.${index}.rate`)}
                      />
                      {itemErrors?.rate && (
                        <p
                          id={`deduction-${index}-rate-error`}
                          role="alert"
                          className="text-sm text-destructive"
                        >
                          {itemErrors.rate.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`deduction-${index}-origin`}>Origem</Label>
                      <select
                        id={`deduction-${index}-origin`}
                        className={selectClassName}
                        disabled={disabled}
                        {...register(`deductions.${index}.origin`)}
                      >
                        <option value="MANUAL">Informação manual</option>
                        <option value="FINANCIAL_AGGREGATE">Agregado financeiro</option>
                        <option value="COPIED">Informação copiada</option>
                      </select>
                    </div>
                  </div>

                  <details className="rounded-lg bg-muted/40 p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Metadados da origem
                    </summary>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {(
                        [
                          ['source', 'Fonte'],
                          ['referenceId', 'Referência'],
                          ['criterion', 'Critério'],
                          ['periodStart', 'Início do período (ISO 8601)'],
                          ['periodEnd', 'Fim do período (ISO 8601)'],
                          ['measuredAt', 'Data da apuração (ISO 8601)'],
                        ] as const
                      ).map(([name, label]) => (
                        <div key={name} className="space-y-2">
                          <Label htmlFor={`deduction-${index}-${name}`}>{label}</Label>
                          <Input
                            id={`deduction-${index}-${name}`}
                            disabled={disabled}
                            aria-invalid={Boolean(itemErrors?.originDetails?.[name])}
                            aria-describedby={
                              itemErrors?.originDetails?.[name]
                                ? `deduction-${index}-${name}-error`
                                : undefined
                            }
                            {...register(`deductions.${index}.originDetails.${name}`)}
                          />
                          {itemErrors?.originDetails?.[name] && (
                            <p
                              id={`deduction-${index}-${name}-error`}
                              role="alert"
                              className="text-sm text-destructive"
                            >
                              {itemErrors.originDetails[name]?.message}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>

                  {canEdit && (
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        aria-label={`Mover dedução ${index + 1} para cima`}
                        disabled={disabled || index === 0}
                        onClick={() => move(index, index - 1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        aria-label={`Mover dedução ${index + 1} para baixo`}
                        disabled={disabled || index === fields.length - 1}
                        onClick={() => move(index, index + 1)}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => remove(index)}
                        disabled={disabled}
                      >
                        <Trash2 data-icon="inline-start" />
                        Remover dedução {index + 1}
                      </Button>
                    </div>
                  )}
                </fieldset>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {hasConflict && (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium">O perfil mudou enquanto você editava.</p>
          <p className="mt-1">Seu rascunho foi preservado. Recarregue antes de salvar.</p>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() => void reloadAfterConflict()}
            disabled={isReloading}
          >
            {isReloading ? 'Recarregando...' : 'Recarregar perfil'}
          </Button>
          {reloadError && (
            <p role="alert" className="mt-3 text-destructive">
              {reloadError}
            </p>
          )}
        </div>
      )}

      {isMutationError && !hasConflict && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {mutationError?.message}
        </p>
      )}
      <p aria-live="polite" className="text-sm text-emerald-700">
        {feedback}
      </p>

      {canEdit ? (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={cancel} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending || hasConflict}>
            {isPending ? 'Salvando...' : profile ? 'Salvar perfil' : 'Criar perfil'}
          </Button>
        </div>
      ) : (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          Seu papel permite consultar este perfil, sem realizar alterações.
        </p>
      )}

      {shouldProtectDraft && (
        <p className="text-xs text-muted-foreground">Existem alterações ainda não salvas.</p>
      )}

      <Dialog.Root
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/45" />
          <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
            <Dialog.Popup className="w-full max-w-md rounded-xl bg-background p-6 shadow-xl outline-none ring-1 ring-foreground/10">
              <Dialog.Title className="text-lg font-semibold">
                Descartar alterações não salvas?
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                Escolha continuar editando ou descartar todos os rascunhos desta página para sair.
              </Dialog.Description>
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => blocker.state === 'blocked' && blocker.reset()}
                >
                  Continuar editando
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => blocker.state === 'blocked' && blocker.proceed()}
                >
                  Descartar e sair
                </Button>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </form>
  );
}
