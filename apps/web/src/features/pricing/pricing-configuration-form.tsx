import { Dialog } from '@base-ui/react/dialog';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useState } from 'react';
import { useForm, useWatch, type FieldPath, type UseFormRegister } from 'react-hook-form';
import { useBeforeUnload, useBlocker } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';

import {
  type PricingConfiguration,
  type PricingConfigurationParameterName,
  type PricingParameterOriginResponse,
} from './pricing-configuration-contracts';
import {
  buildPricingConfigurationPatch,
  pricingConfigurationFormSchema,
  pricingConfigurationToFormValues,
  type PricingConfigurationFormValues,
} from './pricing-configuration-form-state';
import { useUpdatePricingConfigurationMutation } from './use-update-pricing-configuration-mutation';

const selectClassName =
  'h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60';

const parameterLabels: Record<PricingConfigurationParameterName, string> = {
  fixedCostMode: 'Modo dos custos fixos',
  fixedCostRate: 'Percentual de custos fixos',
  monthlyFixedCost: 'Custo fixo mensal',
  averageMonthlyRevenue: 'Faturamento médio mensal',
  monthlyLaborCost: 'Custo mensal de mão de obra',
  productiveHours: 'Horas produtivas mensais',
  defaultDesiredMargin: 'Margem desejada padrão',
};

const originLabels = {
  MANUAL: 'Informação manual',
  FINANCIAL_AGGREGATE: 'Agregado financeiro',
  COPIED: 'Informação copiada',
} as const;

interface OriginEditorProps {
  parameter: PricingConfigurationParameterName;
  register: UseFormRegister<PricingConfigurationFormValues>;
  disabled: boolean;
  persisted?: PricingParameterOriginResponse;
  errors?: Partial<
    Record<
      'source' | 'referenceId' | 'periodStart' | 'periodEnd' | 'criterion' | 'measuredAt',
      { message?: string }
    >
  >;
}

function OriginEditor({ parameter, register, disabled, persisted, errors }: OriginEditorProps) {
  const prefix = `origins.${parameter}` as const;

  return (
    <details className="rounded-lg border bg-muted/30 p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Origem de {parameterLabels[parameter].toLocaleLowerCase('pt-BR')}
      </summary>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${parameter}-origin`}>Origem</Label>
          <select
            id={`${parameter}-origin`}
            className={selectClassName}
            disabled={disabled}
            {...register(`${prefix}.origin`)}
          >
            {Object.entries(originLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <OriginTextField
          id={`${parameter}-source`}
          label="Fonte"
          path={`${prefix}.source`}
          register={register}
          disabled={disabled}
          error={errors?.source?.message}
        />
        <OriginTextField
          id={`${parameter}-reference`}
          label="Referência"
          path={`${prefix}.referenceId`}
          register={register}
          disabled={disabled}
          error={errors?.referenceId?.message}
        />
        <OriginTextField
          id={`${parameter}-criterion`}
          label="Critério"
          path={`${prefix}.criterion`}
          register={register}
          disabled={disabled}
          error={errors?.criterion?.message}
        />
        <OriginTextField
          id={`${parameter}-period-start`}
          label="Início do período (ISO 8601)"
          path={`${prefix}.periodStart`}
          register={register}
          disabled={disabled}
          error={errors?.periodStart?.message}
        />
        <OriginTextField
          id={`${parameter}-period-end`}
          label="Fim do período (ISO 8601)"
          path={`${prefix}.periodEnd`}
          register={register}
          disabled={disabled}
          error={errors?.periodEnd?.message}
        />
        <OriginTextField
          id={`${parameter}-measured-at`}
          label="Data da apuração (ISO 8601)"
          path={`${prefix}.measuredAt`}
          register={register}
          disabled={disabled}
          error={errors?.measuredAt?.message}
        />
      </div>
      {persisted && (
        <p className="mt-3 text-xs text-muted-foreground">
          Confirmação registrada pelo usuário {persisted.confirmedByUserId}.
        </p>
      )}
    </details>
  );
}

interface OriginTextFieldProps {
  id: string;
  label: string;
  path: FieldPath<PricingConfigurationFormValues>;
  register: UseFormRegister<PricingConfigurationFormValues>;
  disabled: boolean;
  error?: string;
}

function OriginTextField({ id, label, path, register, disabled, error }: OriginTextFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
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

interface DecimalFieldProps {
  id: string;
  label: string;
  name:
    | 'fixedCostRate'
    | 'monthlyFixedCost'
    | 'averageMonthlyRevenue'
    | 'monthlyLaborCost'
    | 'productiveHours'
    | 'defaultDesiredMargin';
  suffix?: string;
  register: UseFormRegister<PricingConfigurationFormValues>;
  error?: string;
  disabled: boolean;
}

function DecimalField({ id, label, name, suffix, register, error, disabled }: DecimalFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          inputMode="decimal"
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          {...register(name)}
        />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

interface PricingConfigurationFormProps {
  configuration: PricingConfiguration | null;
  canEdit: boolean;
  onCancel?: () => void;
  onReload: () => Promise<
    { success: true; configuration: PricingConfiguration } | { success: false; error: string }
  >;
}

export function PricingConfigurationForm({
  configuration,
  canEdit,
  onCancel,
  onReload,
}: PricingConfigurationFormProps) {
  const initialValues = pricingConfigurationToFormValues(configuration);
  const mutation = useUpdatePricingConfigurationMutation();
  const [feedback, setFeedback] = useState<string>();
  const [hasConflict, setHasConflict] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [reloadError, setReloadError] = useState<string>();
  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
    setError,
  } = useForm<PricingConfigurationFormValues>({
    resolver: zodResolver(pricingConfigurationFormSchema),
    defaultValues: initialValues,
  });
  const values = useWatch({ control });
  const fixedCostMode = values.fixedCostMode;
  const shouldProtectDraft = canEdit && isDirty;
  const blocker = useBlocker(shouldProtectDraft);

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
    reset(pricingConfigurationToFormValues(configuration));
  }, [configuration, reset]);

  function submit(valuesToSubmit: PricingConfigurationFormValues) {
    const patch = buildPricingConfigurationPatch(valuesToSubmit, configuration);
    mutation.reset();
    setHasConflict(false);
    setReloadError(undefined);

    if (!patch.changed) {
      setFeedback('Nenhuma alteração para salvar. A revisão atual foi preservada.');
      return;
    }

    setFeedback(undefined);
    mutation.mutate(patch.input, {
      onSuccess: (saved) => {
        const previousRevision = configuration?.currentRevision.revision;
        setFeedback(
          previousRevision === saved.currentRevision.revision
            ? 'Nenhuma nova revisão foi necessária.'
            : configuration
              ? `Configuração salva na revisão ${saved.currentRevision.revision}.`
              : 'Configuração inicial criada.',
        );
        reset(pricingConfigurationToFormValues(saved));
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

        if (error instanceof ApiError && error.field && error.field in initialValues) {
          setError(error.field as keyof PricingConfigurationFormValues, {
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

      reset(pricingConfigurationToFormValues(result.configuration));
      mutation.reset();
      setHasConflict(false);
      setFeedback('Configuração recarregada. Revise os dados antes de editar novamente.');
    } finally {
      setIsReloading(false);
    }
  }

  function cancel() {
    reset(pricingConfigurationToFormValues(configuration));
    mutation.reset();
    setHasConflict(false);
    setReloadError(undefined);
    setFeedback(undefined);
    onCancel?.();
  }

  const originIsVisible = (parameter: PricingConfigurationParameterName) => {
    if (parameter === 'fixedCostMode') return fixedCostMode !== '';
    if (parameter === 'fixedCostRate') return fixedCostMode === 'RATE';
    if (parameter === 'monthlyFixedCost' || parameter === 'averageMonthlyRevenue') {
      return fixedCostMode === 'MONTHLY';
    }
    return String(values[parameter] ?? '').trim() !== '';
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit(submit)} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Parâmetros editáveis</CardTitle>
          <CardDescription>
            Percentuais são exibidos em unidade humana. Por exemplo, 25 corresponde à fração
            persistida 0.25.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pricing-currency">Moeda</Label>
              <Input id="pricing-currency" value="BRL" disabled readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fixed-cost-mode">Tratamento dos custos fixos</Label>
              <select
                id="fixed-cost-mode"
                className={selectClassName}
                disabled={!canEdit || mutation.isPending}
                {...register('fixedCostMode')}
              >
                <option value="">Não configurado</option>
                <option value="RATE">Percentual informado</option>
                <option value="MONTHLY">Valores mensais</option>
              </select>
            </div>
          </div>

          {fixedCostMode === 'RATE' && (
            <DecimalField
              id="fixed-cost-rate"
              label="Custos fixos"
              name="fixedCostRate"
              suffix="%"
              register={register}
              error={errors.fixedCostRate?.message}
              disabled={!canEdit || mutation.isPending}
            />
          )}

          {fixedCostMode === 'MONTHLY' && (
            <div className="grid gap-5 md:grid-cols-2">
              <DecimalField
                id="monthly-fixed-cost"
                label="Custo fixo mensal"
                name="monthlyFixedCost"
                register={register}
                error={errors.monthlyFixedCost?.message}
                disabled={!canEdit || mutation.isPending}
              />
              <DecimalField
                id="average-monthly-revenue"
                label="Faturamento médio mensal"
                name="averageMonthlyRevenue"
                register={register}
                error={errors.averageMonthlyRevenue?.message}
                disabled={!canEdit || mutation.isPending}
              />
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <DecimalField
              id="monthly-labor-cost"
              label="Custo mensal de mão de obra"
              name="monthlyLaborCost"
              register={register}
              error={errors.monthlyLaborCost?.message}
              disabled={!canEdit || mutation.isPending}
            />
            <DecimalField
              id="productive-hours"
              label="Horas produtivas mensais"
              name="productiveHours"
              register={register}
              error={errors.productiveHours?.message}
              disabled={!canEdit || mutation.isPending}
            />
          </div>

          <DecimalField
            id="default-desired-margin"
            label="Margem desejada padrão"
            name="defaultDesiredMargin"
            suffix="%"
            register={register}
            error={errors.defaultDesiredMargin?.message}
            disabled={!canEdit || mutation.isPending}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Origens dos parâmetros</CardTitle>
          <CardDescription>
            Ao alterar um valor, sua origem será confirmada pelo usuário autenticado no backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(
            [
              'fixedCostMode',
              'fixedCostRate',
              'monthlyFixedCost',
              'averageMonthlyRevenue',
              'monthlyLaborCost',
              'productiveHours',
              'defaultDesiredMargin',
            ] as const
          ).map(
            (parameter) =>
              originIsVisible(parameter) && (
                <OriginEditor
                  key={parameter}
                  parameter={parameter}
                  register={register}
                  disabled={!canEdit || mutation.isPending}
                  persisted={configuration?.currentRevision.parameterOrigins[parameter]}
                  errors={errors.origins?.[parameter]}
                />
              ),
          )}
        </CardContent>
      </Card>

      {configuration && (
        <Card>
          <CardHeader>
            <CardTitle>Informações controladas pelo sistema</CardTitle>
            <CardDescription>
              Estes dados são somente leitura. No modo mensal, a taxa efetiva é calculada pelo
              backend durante a precificação.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
            <p>
              <span className="block text-muted-foreground">Revisão atual</span>
              <strong>{configuration.currentRevision.revision}</strong>
            </p>
            <p>
              <span className="block text-muted-foreground">Vigência</span>
              <strong>{configuration.currentRevision.effectiveFrom}</strong>
            </p>
            <p>
              <span className="block text-muted-foreground">Estado</span>
              <strong>{configuration.isActive ? 'Ativa' : 'Inativa'}</strong>
            </p>
          </CardContent>
        </Card>
      )}

      {hasConflict && (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium">Os dados persistidos mudaram enquanto você editava.</p>
          <p className="mt-1">
            Seu rascunho foi preservado. Recarregue explicitamente antes de salvar.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={reloadAfterConflict}
            disabled={isReloading}
          >
            {isReloading ? 'Recarregando...' : 'Recarregar configuração'}
          </Button>
          {reloadError && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {reloadError}
            </p>
          )}
        </div>
      )}

      {mutation.isError && !hasConflict && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {mutation.error.message}
        </p>
      )}

      <p aria-live="polite" className="text-sm text-emerald-700">
        {feedback}
      </p>

      {canEdit ? (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={cancel} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending || hasConflict}>
            {mutation.isPending
              ? 'Salvando...'
              : configuration
                ? 'Salvar configuração'
                : 'Criar configuração'}
          </Button>
        </div>
      ) : (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          Seu papel permite consultar esta configuração, sem realizar alterações.
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
          <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
            <Dialog.Popup className="w-full max-w-md rounded-xl bg-background p-6 shadow-xl outline-none ring-1 ring-foreground/10">
              <Dialog.Title className="text-lg font-semibold">
                Descartar alterações não salvas?
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                Você possui alterações na configuração. Escolha continuar editando ou descartar o
                rascunho para seguir para outra página.
              </Dialog.Description>
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (blocker.state === 'blocked') blocker.reset();
                  }}
                >
                  Continuar editando
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    if (blocker.state === 'blocked') blocker.proceed();
                  }}
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
