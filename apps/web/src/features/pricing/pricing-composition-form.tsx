import { Dialog } from '@base-ui/react/dialog';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useFieldArray,
  useForm,
  useWatch,
  type FieldErrors,
  type FieldPath,
  type UseFormRegister,
} from 'react-hook-form';
import { useBeforeUnload, useBlocker } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import type { Product } from '@/features/products/products-api';

import type {
  PricingComposition,
  PricingCompositionParameterName,
} from './pricing-composition-contracts';
import type { PricingConfiguration } from './pricing-configuration-contracts';
import { pricingCompositionParameterNames } from './pricing-composition-contracts';
import {
  buildPricingCompositionInput,
  createPricingCompositionFormSchema,
  emptyPricingCompositionComponent,
  pricingCompositionToFormValues,
  type PricingCompositionFormValues,
} from './pricing-composition-form-state';
import type { PricingProfileItem } from './pricing-profiles-contracts';
import { buildLocalPricingPreview } from './pricing-preview-adapter';
import { PricingPreviewPanel, type PricingPreviewViewState } from './pricing-preview-panel';
import {
  buildPricingSimulationInput,
  hasAuthoritativePricingParity,
  hasAuthoritativeResolvedInputParity,
  pricingSimulationSignature,
} from './pricing-simulation-adapter';
import { PricingSimulationPanel, type PricingSimulationDisplay } from './pricing-simulation-panel';
import type { PricingSimulationResponse } from './pricing-simulation-contracts';
import { canonicalizeCommercialDecimalInput } from './format-pricing';
import { PricingVersionsPanel } from './pricing-versions-panel';
import { useCreatePricingVersionMutation } from './use-pricing-versions';
import { usePricingProfileQuery } from './use-pricing-profiles-query';
import { usePricingSimulationMutation } from './use-pricing-simulation-mutation';
import { usePutPricingCompositionMutation } from './use-put-pricing-composition-mutation';

const selectClassName =
  'h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60';

const originLabels = {
  MANUAL: 'Informação manual',
  FINANCIAL_AGGREGATE: 'Agregado financeiro',
  COPIED: 'Informação copiada',
} as const;

const parameterLabels: Record<PricingCompositionParameterName, string> = {
  desiredMargin: 'margem desejada',
  laborEnabled: 'uso de mão de obra',
  timeMinutes: 'tempo',
  freightMode: 'modo de frete',
  freightUnitCost: 'custo unitário do frete',
  freightTotalCost: 'custo total do frete',
  freightQuantity: 'quantidade de rateio',
  freightConsumedQuantity: 'quantidade consumida',
};

const categoryLabels = {
  DIRECT_COST: 'Custo direto',
  MATERIAL: 'Material',
  PACKAGING: 'Embalagem',
  LABOR: 'Mão de obra',
  FREIGHT: 'Frete',
  OUTSOURCING: 'Terceirização',
  LOSS: 'Perda',
  OTHER: 'Outro',
} as const;

interface PricingCompositionFormProps {
  productId: string;
  product: Product;
  composition: PricingComposition | null;
  canEdit: boolean;
  canSimulate: boolean;
  profiles: PricingProfileItem[];
  catalogProducts: PricingCatalogProductOption[];
  configuration?: PricingConfiguration;
  configurationStatus: 'loading' | 'available' | 'missing' | 'error';
  configurationError?: string;
  onCancel?: () => void;
  onReload: () => Promise<
    { success: true; composition: PricingComposition | null } | { success: false; error: string }
  >;
}

export interface PricingCatalogProductOption {
  id: string;
  name: string;
  unit: string;
  directCost: string | null | undefined;
  isActive: boolean;
  eligible: boolean;
}

function fieldError(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return typeof error.message === 'string' ? error.message : undefined;
  }
  return undefined;
}

function TextField({
  id,
  label,
  path,
  register,
  disabled,
  error,
  inputMode,
}: {
  id: string;
  label: string;
  path: FieldPath<PricingCompositionFormValues>;
  register: UseFormRegister<PricingCompositionFormValues>;
  disabled: boolean;
  error?: string;
  inputMode?: 'decimal';
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode={inputMode}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...register(path)}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function ParameterOriginEditor({
  parameter,
  register,
  disabled,
  errors,
}: {
  parameter: PricingCompositionParameterName;
  register: UseFormRegister<PricingCompositionFormValues>;
  disabled: boolean;
  errors?: FieldErrors<PricingCompositionFormValues>['parameterOrigins'];
}) {
  const prefix = `parameterOrigins.${parameter}` as const;
  const parameterErrors = errors?.[parameter];
  return (
    <details className="rounded-lg border bg-muted/30 p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Origem de {parameterLabels[parameter]}
      </summary>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${parameter}-origin`}>Origem</Label>
          <select
            id={`${parameter}-origin`}
            className={selectClassName}
            disabled={disabled}
            aria-invalid={Boolean(parameterErrors?.origin)}
            {...register(`${prefix}.origin`)}
          >
            <option value="">Sem origem informada</option>
            {Object.entries(originLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {parameterErrors?.origin?.message && (
            <p role="alert" className="text-sm text-destructive">
              {parameterErrors.origin.message}
            </p>
          )}
        </div>
        {(
          [
            ['source', 'Fonte'],
            ['referenceId', 'Referência'],
            ['criterion', 'Critério'],
            ['periodStart', 'Início do período (ISO 8601)'],
            ['periodEnd', 'Fim do período (ISO 8601)'],
            ['measuredAt', 'Data da apuração (ISO 8601)'],
          ] as const
        ).map(([field, label]) => (
          <TextField
            key={field}
            id={`${parameter}-${field}`}
            label={label}
            path={`${prefix}.${field}`}
            register={register}
            disabled={disabled}
            error={parameterErrors?.[field]?.message}
          />
        ))}
      </div>
    </details>
  );
}

export function PricingCompositionForm({
  productId,
  product,
  composition,
  canEdit,
  canSimulate,
  profiles,
  catalogProducts,
  configuration,
  configurationStatus,
  configurationError,
  onCancel,
  onReload,
}: PricingCompositionFormProps) {
  const mutation = usePutPricingCompositionMutation(productId);
  const simulationMutation = usePricingSimulationMutation(productId);
  const versionMutation = useCreatePricingVersionMutation(productId);
  const versionSubmitting = useRef(false);
  const simulationGeneration = useRef(0);
  const schema = useMemo(() => createPricingCompositionFormSchema(productId), [productId]);
  const [feedback, setFeedback] = useState<string>();
  const [hasConflict, setHasConflict] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [reloadError, setReloadError] = useState<string>();
  const [versionConsumed, setVersionConsumed] = useState(false);
  const [createdVersionId, setCreatedVersionId] = useState<string>();
  const [createdVersionNumber, setCreatedVersionNumber] = useState<number>();
  const [authoritativeSimulation, setAuthoritativeSimulation] = useState<{
    response: PricingSimulationResponse;
    signature: string;
  }>();
  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
    setError,
    setFocus,
    setValue,
  } = useForm<PricingCompositionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: pricingCompositionToFormValues(composition),
  });
  const components = useFieldArray({ control, name: 'components' });
  const values = useWatch({ control }) as PricingCompositionFormValues;
  const selectedProfileId = values.profileId ?? '';
  const selectedProfileQuery = usePricingProfileQuery(selectedProfileId, selectedProfileId !== '');
  const shouldProtectDraft = canEdit && isDirty;
  const blocker = useBlocker(shouldProtectDraft);
  const disabled = !canEdit || mutation.isPending || versionMutation.isPending || hasConflict;

  const previewState = useMemo<PricingPreviewViewState>(() => {
    if (configurationStatus === 'loading') {
      return { status: 'waiting', message: 'Carregando a configuração organizacional...' };
    }
    if (configurationStatus === 'missing') {
      return {
        status: 'configuration-missing',
        message: 'Configure os parâmetros organizacionais antes de calcular a prévia.',
      };
    }
    if (configurationStatus === 'error' || !configuration) {
      return {
        status: 'dependency-error',
        message: configurationError ?? 'Não foi possível carregar a configuração de precificação.',
      };
    }
    if (selectedProfileId !== '' && selectedProfileQuery.isPending) {
      return { status: 'profile-loading', message: 'Carregando o perfil selecionado...' };
    }
    if (selectedProfileId !== '' && selectedProfileQuery.isError) {
      return {
        status: 'profile-error',
        message: selectedProfileQuery.error.message,
      };
    }
    return buildLocalPricingPreview({
      product,
      values,
      configuration,
      profile: selectedProfileId === '' ? null : (selectedProfileQuery.data ?? null),
      catalogProducts,
    });
  }, [
    catalogProducts,
    configuration,
    configurationError,
    configurationStatus,
    product,
    selectedProfileId,
    selectedProfileQuery.data,
    selectedProfileQuery.error,
    selectedProfileQuery.isError,
    selectedProfileQuery.isPending,
    values,
  ]);
  const currentSimulationSignature = useMemo(() => {
    if (previewState.status !== 'available') return null;
    try {
      return pricingSimulationSignature(buildPricingSimulationInput(values, composition, product));
    } catch {
      return null;
    }
  }, [composition, previewState.status, product, values]);
  const simulationMatchesCurrentContext =
    authoritativeSimulation !== undefined &&
    previewState.status === 'available' &&
    authoritativeSimulation.response.productId === productId &&
    authoritativeSimulation.response.configuration.id === configuration?.id &&
    authoritativeSimulation.response.configuration.revisionId ===
      configuration?.currentRevision.id &&
    authoritativeSimulation.response.configuration.revision ===
      configuration?.currentRevision.revision &&
    authoritativeSimulation.response.profile?.id === (selectedProfileId || undefined) &&
    authoritativeSimulation.response.profile?.revisionId ===
      selectedProfileQuery.data?.currentRevision.id &&
    authoritativeSimulation.response.effectiveDesiredMargin.precedence ===
      (values.desiredMargin.trim() === '' ? 'CONFIGURATION' : 'COMPOSITION') &&
    authoritativeSimulation.response.effectiveDesiredMargin.origin ===
      (values.desiredMargin.trim() === ''
        ? configuration?.currentRevision.parameterOrigins.defaultDesiredMargin?.origin
        : values.parameterOrigins.desiredMargin.origin) &&
    (authoritativeSimulation.response.adoptedPrice === null
      ? product.salePrice === null
      : canonicalizeCommercialDecimalInput(authoritativeSimulation.response.adoptedPrice) ===
        canonicalizeCommercialDecimalInput(product.salePrice ?? '')) &&
    hasAuthoritativeResolvedInputParity(previewState.input, authoritativeSimulation.response);
  const simulationDisplay: PricingSimulationDisplay | undefined = authoritativeSimulation
    ? {
        response: authoritativeSimulation.response,
        matchesLocalPreview:
          simulationMatchesCurrentContext &&
          previewState.status === 'available' &&
          hasAuthoritativePricingParity(previewState.result, authoritativeSimulation.response),
        stale:
          currentSimulationSignature === null ||
          currentSimulationSignature !== authoritativeSimulation.signature,
      }
    : undefined;
  const canCreateVersion =
    canSimulate &&
    composition !== null &&
    !hasConflict &&
    !versionConsumed &&
    !versionMutation.isPending &&
    !mutation.isPending &&
    !simulationMutation.isPending &&
    simulationDisplay !== undefined &&
    simulationDisplay.response.source === 'PERSISTED' &&
    simulationDisplay.response.compositionRevision === composition.revision &&
    simulationMatchesCurrentContext &&
    !simulationDisplay.stale &&
    simulationDisplay.matchesLocalPreview &&
    currentSimulationSignature !== null &&
    !buildPricingCompositionInput(values, composition).changed;

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
    reset(pricingCompositionToFormValues(composition));
    simulationGeneration.current += 1;
    setAuthoritativeSimulation(undefined);
    simulationMutation.reset();
    versionMutation.reset();
    // The composition identity/revision is the persisted boundary for transient simulations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composition, reset]);

  const visibleOrigins = pricingCompositionParameterNames.filter((name) => {
    if (name === 'laborEnabled') return true;
    if (name === 'desiredMargin') return values.desiredMargin?.trim() !== '';
    if (name === 'timeMinutes') return values.laborEnabled;
    if (name === 'freightMode') return values.freightMode !== '';
    if (name === 'freightUnitCost') return values.freightMode === 'MANUAL';
    if (name === 'freightTotalCost' || name === 'freightQuantity') {
      return values.freightMode === 'ALLOCATED';
    }
    return values.freightMode === 'ALLOCATED' && values.freightConsumedQuantity?.trim() !== '';
  });

  function submit(formValues: PricingCompositionFormValues) {
    const payload = buildPricingCompositionInput(formValues, composition);
    mutation.reset();
    simulationGeneration.current += 1;
    setAuthoritativeSimulation(undefined);
    simulationMutation.reset();
    versionMutation.reset();
    setReloadError(undefined);
    if (!payload.changed) {
      setFeedback('Nenhuma alteração para salvar. A revisão atual foi preservada.');
      return;
    }
    setFeedback(undefined);
    mutation.mutate(payload.input, {
      onSuccess: (saved) => {
        reset(pricingCompositionToFormValues(saved));
        simulationGeneration.current += 1;
        setAuthoritativeSimulation(undefined);
        simulationMutation.reset();
        versionMutation.reset();
        setHasConflict(false);
        setFeedback(
          composition
            ? `Composição salva na revisão ${saved.revision}.`
            : 'Composição inicial criada.',
        );
      },
      onError: (error) => {
        if (
          error instanceof ApiError &&
          (error.code === 'PRICING_REVISION_CONFLICT' ||
            error.code === 'PRICING_CONCURRENT_MODIFICATION')
        ) {
          setHasConflict(true);
          return;
        }
        if (error instanceof ApiError && error.field) {
          setError(error.field as FieldPath<PricingCompositionFormValues>, {
            message: error.message,
          });
        }
      },
    });
  }

  async function reloadAfterConflict() {
    setIsReloading(true);
    setReloadError(undefined);
    try {
      const result = await onReload();
      if (!result.success) {
        setReloadError(result.error);
        return;
      }
      reset(pricingCompositionToFormValues(result.composition));
      mutation.reset();
      simulationGeneration.current += 1;
      simulationMutation.reset();
      versionMutation.reset();
      setAuthoritativeSimulation(undefined);
      setHasConflict(false);
      setFeedback('Composição recarregada. Revise os dados antes de editar novamente.');
    } finally {
      setIsReloading(false);
    }
  }

  function cancel() {
    reset(pricingCompositionToFormValues(composition));
    mutation.reset();
    simulationGeneration.current += 1;
    simulationMutation.reset();
    versionMutation.reset();
    setAuthoritativeSimulation(undefined);
    setHasConflict(false);
    setReloadError(undefined);
    setFeedback(undefined);
    onCancel?.();
  }

  function simulate(formValues: PricingCompositionFormValues) {
    if (previewState.status !== 'available' || versionSubmitting.current) return;
    const input = buildPricingSimulationInput(formValues, composition, product);
    const signature = pricingSimulationSignature(input);
    const generation = ++simulationGeneration.current;
    setAuthoritativeSimulation(undefined);
    simulationMutation.reset();
    versionMutation.reset();
    simulationMutation.mutate(input, {
      onSuccess: (response) => {
        if (generation !== simulationGeneration.current) return;
        setAuthoritativeSimulation({
          response,
          signature,
        });
        setVersionConsumed(false);
      },
    });
  }

  function createVersion() {
    if (!canCreateVersion || !composition || versionSubmitting.current) return;
    versionSubmitting.current = true;
    versionMutation.reset();
    versionMutation.mutate(
      {
        expectedCompositionRevision: composition.revision,
        ...(typeof product.salePrice === 'string' ? { adoptedPrice: product.salePrice } : {}),
      },
      {
        onSuccess: (created) => {
          setVersionConsumed(true);
          setCreatedVersionId(created.id);
          setCreatedVersionNumber(created.number);
        },
        onError: (error) => {
          if (
            error instanceof ApiError &&
            (error.code === 'PRICING_REVISION_CONFLICT' ||
              error.code === 'PRICING_CONCURRENT_MODIFICATION')
          ) {
            simulationGeneration.current += 1;
            setAuthoritativeSimulation(undefined);
            setHasConflict(true);
          }
        },
        onSettled: () => {
          versionSubmitting.current = false;
        },
      },
    );
  }

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={handleSubmit(submit, () => {
        const invalid = document.querySelector<HTMLElement>('[aria-invalid="true"]');
        invalid?.focus();
      })}
    >
      <Card>
        <CardHeader>
          <CardTitle>Parâmetros da composição</CardTitle>
          <CardDescription>
            Decimais são preservados como texto e normalizados somente ao salvar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="composition-profile">Perfil de venda</Label>
              <select
                id="composition-profile"
                className={selectClassName}
                disabled={disabled}
                aria-invalid={Boolean(errors.profileId)}
                value={selectedProfileId}
                {...register('profileId')}
              >
                <option value="">Sem perfil</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.currentRevision.name}
                  </option>
                ))}
                {selectedProfileQuery.data &&
                  !profiles.some((profile) => profile.id === selectedProfileQuery.data.id) && (
                    <option value={selectedProfileQuery.data.id}>
                      {selectedProfileQuery.data.currentRevision.name} (inativo)
                    </option>
                  )}
                {selectedProfileId !== '' &&
                  !profiles.some((profile) => profile.id === selectedProfileId) &&
                  !selectedProfileQuery.data && (
                    <option value={selectedProfileId}>Carregando perfil selecionado...</option>
                  )}
              </select>
              {errors.profileId?.message && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.profileId.message}
                </p>
              )}
            </div>
            <TextField
              id="composition-margin"
              label="Margem desejada (%)"
              path="desiredMargin"
              register={register}
              disabled={disabled}
              inputMode="decimal"
              error={errors.desiredMargin?.message}
            />
          </div>

          <label className="flex items-center gap-3 text-sm font-medium">
            <input type="checkbox" disabled={disabled} {...register('laborEnabled')} />
            Considerar tempo de mão de obra
          </label>
          {values.laborEnabled && (
            <TextField
              id="composition-time"
              label="Tempo (minutos)"
              path="timeMinutes"
              register={register}
              disabled={disabled}
              inputMode="decimal"
              error={errors.timeMinutes?.message}
            />
          )}

          <div className="space-y-2">
            <Label htmlFor="composition-freight-mode">Frete</Label>
            <select
              id="composition-freight-mode"
              className={selectClassName}
              disabled={disabled}
              aria-invalid={Boolean(errors.freightMode)}
              {...register('freightMode', {
                onChange: (event) => {
                  const mode = event.target.value as '' | 'MANUAL' | 'ALLOCATED';
                  if (mode !== 'MANUAL') setValue('freightUnitCost', '', { shouldDirty: true });
                  if (mode !== 'ALLOCATED') {
                    setValue('freightTotalCost', '', { shouldDirty: true });
                    setValue('freightQuantity', '', { shouldDirty: true });
                    setValue('freightConsumedQuantity', '', { shouldDirty: true });
                  }
                },
              })}
            >
              <option value="">Sem frete</option>
              <option value="MANUAL">Custo unitário manual</option>
              <option value="ALLOCATED">Rateio</option>
            </select>
          </div>
          {values.freightMode === 'MANUAL' && (
            <TextField
              id="freight-unit-cost"
              label="Custo unitário do frete"
              path="freightUnitCost"
              register={register}
              disabled={disabled}
              inputMode="decimal"
              error={errors.freightUnitCost?.message}
            />
          )}
          {values.freightMode === 'ALLOCATED' && (
            <div className="grid gap-5 md:grid-cols-3">
              <TextField
                id="freight-total-cost"
                label="Custo total do frete"
                path="freightTotalCost"
                register={register}
                disabled={disabled}
                inputMode="decimal"
                error={errors.freightTotalCost?.message}
              />
              <TextField
                id="freight-quantity"
                label="Quantidade de rateio"
                path="freightQuantity"
                register={register}
                disabled={disabled}
                inputMode="decimal"
                error={errors.freightQuantity?.message}
              />
              <TextField
                id="freight-consumed"
                label="Quantidade consumida"
                path="freightConsumedQuantity"
                register={register}
                disabled={disabled}
                inputMode="decimal"
                error={errors.freightConsumedQuantity?.message}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <PricingPreviewPanel
        state={previewState}
        analyzesCurrentPrice={typeof product.salePrice === 'string'}
        onRetryProfile={
          previewState.status === 'profile-error'
            ? () => void selectedProfileQuery.refetch()
            : undefined
        }
        isRetryingProfile={selectedProfileQuery.isFetching}
      />

      <PricingSimulationPanel
        canSimulate={canSimulate}
        simulation={simulationDisplay}
        error={simulationMutation.error?.message}
        isPending={simulationMutation.isPending}
        canSubmit={
          previewState.status === 'available' && !hasConflict && !versionMutation.isPending
        }
        onSimulate={() => void handleSubmit(simulate)()}
      />

      {canSimulate && (
        <Card>
          <CardHeader>
            <CardTitle>Salvar versão</CardTitle>
            <CardDescription>
              Cria um cálculo histórico finalizado a partir da composição salva. Não altera nem
              adota o preço do produto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button type="button" disabled={!canCreateVersion} onClick={createVersion}>
              {versionMutation.isPending ? 'Criando versão...' : 'Salvar versão'}
            </Button>
            {!canCreateVersion && !versionConsumed && (
              <p className="text-sm text-muted-foreground">
                Salve a composição e confirme novamente uma simulação PERSISTED em paridade antes de
                criar a versão. Uma simulação DRAFT não pode ser salva como versão.
              </p>
            )}
            {versionConsumed && (
              <p role="status" className="text-sm">
                Confirmação utilizada. Execute uma nova simulação antes de criar outra versão.
                Versão nº {createdVersionNumber} criada: {createdVersionId}.
              </p>
            )}
            {versionMutation.isError && (
              <p role="alert" className="text-sm text-destructive">
                {versionMutation.error.message}
              </p>
            )}
          </CardContent>
        </Card>
      )}
      <PricingVersionsPanel productId={productId} createdVersionId={createdVersionId} />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Componentes</CardTitle>
              <CardDescription>A ordem visual define as posições persistidas.</CardDescription>
            </div>
            {canEdit && (
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() =>
                  components.append(structuredClone(emptyPricingCompositionComponent), {
                    focusName: `components.${components.fields.length}.description`,
                  })
                }
              >
                <Plus /> Adicionar componente
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {components.fields.length === 0 && (
            <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
              Nenhum componente informado.
            </p>
          )}
          {components.fields.map((field, index) => {
            const component = values.components?.[index];
            const componentErrors = errors.components?.[index];
            return (
              <fieldset key={field.id} className="min-w-0 space-y-4 rounded-xl border p-4">
                <legend className="px-1 text-sm font-semibold">Componente {index + 1}</legend>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label={`Mover componente ${index + 1} para cima`}
                    disabled={disabled || index === 0}
                    onClick={() => components.move(index, index - 1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label={`Mover componente ${index + 1} para baixo`}
                    disabled={disabled || index === components.fields.length - 1}
                    onClick={() => components.move(index, index + 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="destructive"
                    aria-label={`Remover componente ${index + 1}`}
                    disabled={disabled}
                    onClick={() => {
                      components.remove(index);
                      if (components.fields.length > 1) {
                        setFocus(`components.${Math.max(0, index - 1)}.description`);
                      }
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField
                    id={`component-${index}-description`}
                    label="Nome"
                    path={`components.${index}.description`}
                    register={register}
                    disabled={disabled}
                    error={componentErrors?.description?.message}
                  />
                  <div className="space-y-2">
                    <Label htmlFor={`component-${index}-category`}>Categoria</Label>
                    <select
                      id={`component-${index}-category`}
                      className={selectClassName}
                      disabled={disabled}
                      {...register(`components.${index}.category`)}
                    >
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <TextField
                    id={`component-${index}-unit`}
                    label="Unidade"
                    path={`components.${index}.unit`}
                    register={register}
                    disabled={disabled}
                    error={componentErrors?.unit?.message}
                  />
                  <TextField
                    id={`component-${index}-quantity`}
                    label="Quantidade"
                    path={`components.${index}.quantity`}
                    register={register}
                    disabled={disabled}
                    inputMode="decimal"
                    error={componentErrors?.quantity?.message}
                  />
                  <div className="space-y-2">
                    <Label htmlFor={`component-${index}-source`}>Origem do custo</Label>
                    <select
                      id={`component-${index}-source`}
                      className={selectClassName}
                      disabled={disabled}
                      {...register(`components.${index}.costSource`, {
                        onChange: (event) => {
                          if (event.target.value === 'CATALOG') {
                            setValue(`components.${index}.storedUnitCost`, '', {
                              shouldDirty: true,
                            });
                          } else {
                            setValue(`components.${index}.sourceProductId`, '', {
                              shouldDirty: true,
                            });
                          }
                        },
                      })}
                    >
                      <option value="MANUAL">Manual</option>
                      <option value="COPIED">Copiado</option>
                      <option value="CATALOG">Catálogo</option>
                    </select>
                  </div>
                  {component?.costSource === 'CATALOG' ? (
                    <div className="space-y-2">
                      <Label htmlFor={`component-${index}-catalog`}>Produto do catálogo</Label>
                      <select
                        id={`component-${index}-catalog`}
                        className={selectClassName}
                        disabled={disabled}
                        aria-invalid={Boolean(componentErrors?.sourceProductId)}
                        {...register(`components.${index}.sourceProductId`, {
                          onChange: (event) => {
                            const selected = catalogProducts.find(
                              (product) => product.id === event.target.value,
                            );
                            if (selected?.eligible) {
                              setValue(`components.${index}.unit`, selected.unit, {
                                shouldDirty: true,
                              });
                            }
                          },
                        })}
                      >
                        <option value="">Selecione</option>
                        {catalogProducts.map((product) => (
                          <option key={product.id} value={product.id} disabled={!product.eligible}>
                            {product.name} ({product.unit})
                            {product.eligible ? '' : ' — referência atual indisponível'}
                          </option>
                        ))}
                      </select>
                      {componentErrors?.sourceProductId?.message && (
                        <p role="alert" className="text-sm text-destructive">
                          {componentErrors.sourceProductId.message}
                        </p>
                      )}
                    </div>
                  ) : (
                    <TextField
                      id={`component-${index}-cost`}
                      label="Custo unitário persistido"
                      path={`components.${index}.storedUnitCost`}
                      register={register}
                      disabled={disabled}
                      inputMode="decimal"
                      error={componentErrors?.storedUnitCost?.message}
                    />
                  )}
                </div>
                <details className="rounded-lg border bg-muted/30 p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Proveniência do componente
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
                    ).map(([originField, label]) => (
                      <TextField
                        key={originField}
                        id={`component-${index}-${originField}`}
                        label={label}
                        path={`components.${index}.originDetails.${originField}`}
                        register={register}
                        disabled={disabled}
                        error={fieldError(componentErrors?.originDetails?.[originField])}
                      />
                    ))}
                  </div>
                </details>
              </fieldset>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Origens dos parâmetros</CardTitle>
          <CardDescription>
            A confirmação do usuário é sempre derivada da sessão pelo backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {visibleOrigins.map((parameter) => (
            <ParameterOriginEditor
              key={parameter}
              parameter={parameter}
              register={register}
              disabled={disabled}
              errors={errors.parameterOrigins}
            />
          ))}
        </CardContent>
      </Card>

      {composition && (
        <p className="text-sm text-muted-foreground">
          Revisão atual: <strong>{composition.revision}</strong>
        </p>
      )}

      {hasConflict && (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium">A composição mudou enquanto você editava.</p>
          <p className="mt-1">Seu rascunho foi preservado. Recarregue antes de salvar.</p>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() => void reloadAfterConflict()}
            disabled={isReloading}
          >
            {isReloading ? 'Recarregando...' : 'Recarregar composição'}
          </Button>
          {reloadError && (
            <p role="alert" className="mt-3 text-destructive">
              {reloadError}
            </p>
          )}
        </div>
      )}
      {mutation.isError && !hasConflict && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {mutation.error.message}
        </p>
      )}
      <p aria-live="polite" className="text-sm text-emerald-700">
        {feedback}
      </p>

      {canEdit ? (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={cancel}
            disabled={mutation.isPending || versionMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending || versionMutation.isPending || hasConflict}
          >
            {mutation.isPending
              ? 'Salvando...'
              : composition
                ? 'Salvar composição'
                : 'Criar composição'}
          </Button>
        </div>
      ) : (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          Seu papel permite consultar esta composição, sem realizar alterações.
        </p>
      )}

      {canEdit && isDirty && (
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
          <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
            <Dialog.Popup className="w-full max-w-md rounded-xl bg-background p-6 shadow-xl outline-none">
              <Dialog.Title className="text-lg font-semibold">
                Descartar alterações não salvas?
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                Continue editando ou descarte o rascunho para seguir para outra página.
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
