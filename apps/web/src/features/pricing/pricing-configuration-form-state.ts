import { z } from 'zod';

import {
  type PricingConfiguration,
  type PricingConfigurationParameterName,
  pricingConfigurationParameterNames,
  pricingIsoDateStringSchema,
  pricingParameterOriginSchema,
  type PricingParameterOriginInput,
  type PricingParameterOriginResponse,
  type UpdatePricingConfigurationInput,
} from './pricing-configuration-contracts';
import {
  canonicalizeDecimalInput,
  canonicalizePercentageInput,
  percentageFractionToInput,
} from './format-pricing';

const decimalValueFields = [
  'monthlyFixedCost',
  'averageMonthlyRevenue',
  'monthlyLaborCost',
  'productiveHours',
] as const;

const percentageFields = ['fixedCostRate', 'defaultDesiredMargin'] as const;

const originFormSchema = z.strictObject({
  origin: pricingParameterOriginSchema,
  source: z.string(),
  referenceId: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  criterion: z.string(),
  measuredAt: z.string(),
});

const originFormShape = Object.fromEntries(
  pricingConfigurationParameterNames.map((parameter) => [parameter, originFormSchema]),
) as Record<PricingConfigurationParameterName, typeof originFormSchema>;

export const pricingConfigurationFormSchema = z
  .strictObject({
    currency: z.literal('BRL'),
    fixedCostMode: z.enum(['', 'RATE', 'MONTHLY']),
    fixedCostRate: z.string(),
    monthlyFixedCost: z.string(),
    averageMonthlyRevenue: z.string(),
    monthlyLaborCost: z.string(),
    productiveHours: z.string(),
    defaultDesiredMargin: z.string(),
    origins: z.strictObject(originFormShape),
  })
  .superRefine((values, context) => {
    for (const field of percentageFields) {
      if (values[field].trim() !== '' && canonicalizePercentageInput(values[field]) === null) {
        context.addIssue({
          code: 'custom',
          path: [field],
          message: 'Informe um percentual válido dentro do limite aceito.',
        });
      }
    }

    for (const field of decimalValueFields) {
      if (
        values[field].trim() !== '' &&
        canonicalizeDecimalInput(values[field], { integerDigits: 13, scale: 6 }) === null
      ) {
        context.addIssue({
          code: 'custom',
          path: [field],
          message: 'Informe um valor não negativo com até seis casas decimais.',
        });
      }
    }

    if (values.fixedCostMode === 'RATE' && values.fixedCostRate.trim() === '') {
      context.addIssue({
        code: 'custom',
        path: ['fixedCostRate'],
        message: 'Informe o percentual de custos fixos.',
      });
    }

    if (values.fixedCostMode === 'MONTHLY') {
      if (values.monthlyFixedCost.trim() === '') {
        context.addIssue({
          code: 'custom',
          path: ['monthlyFixedCost'],
          message: 'Informe o custo fixo mensal.',
        });
      }

      if (values.averageMonthlyRevenue.trim() === '') {
        context.addIssue({
          code: 'custom',
          path: ['averageMonthlyRevenue'],
          message: 'Informe o faturamento médio mensal.',
        });
      } else if (
        canonicalizeDecimalInput(values.averageMonthlyRevenue, {
          integerDigits: 13,
          scale: 6,
        }) === '0'
      ) {
        context.addIssue({
          code: 'custom',
          path: ['averageMonthlyRevenue'],
          message: 'O faturamento médio mensal deve ser maior que zero.',
        });
      }
    }

    const hasLaborCost = values.monthlyLaborCost.trim() !== '';
    const hasProductiveHours = values.productiveHours.trim() !== '';
    if (hasLaborCost !== hasProductiveHours) {
      context.addIssue({
        code: 'custom',
        path: [hasLaborCost ? 'productiveHours' : 'monthlyLaborCost'],
        message: 'Informe custo mensal e horas produtivas juntos.',
      });
    }

    if (
      hasProductiveHours &&
      canonicalizeDecimalInput(values.productiveHours, {
        integerDigits: 13,
        scale: 6,
      }) === '0'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['productiveHours'],
        message: 'As horas produtivas devem ser maiores que zero.',
      });
    }

    for (const parameter of pricingConfigurationParameterNames) {
      const origin = values.origins[parameter];
      for (const dateField of ['periodStart', 'periodEnd', 'measuredAt'] as const) {
        if (
          origin[dateField] !== '' &&
          !pricingIsoDateStringSchema.safeParse(origin[dateField]).success
        ) {
          context.addIssue({
            code: 'custom',
            path: ['origins', parameter, dateField],
            message: 'Informe uma data ISO 8601 válida.',
          });
        }
      }
    }
  });

export type PricingConfigurationFormValues = z.infer<typeof pricingConfigurationFormSchema>;

const emptyOrigin = {
  origin: 'MANUAL',
  source: '',
  referenceId: '',
  periodStart: '',
  periodEnd: '',
  criterion: '',
  measuredAt: '',
} as const;

function originToForm(origin: PricingParameterOriginResponse | undefined) {
  return {
    origin: origin?.origin ?? emptyOrigin.origin,
    source: origin?.source ?? '',
    referenceId: origin?.referenceId ?? '',
    periodStart: origin?.periodStart ?? '',
    periodEnd: origin?.periodEnd ?? '',
    criterion: origin?.criterion ?? '',
    measuredAt: origin?.measuredAt ?? '',
  };
}

export function pricingConfigurationToFormValues(
  configuration: PricingConfiguration | null,
): PricingConfigurationFormValues {
  const revision = configuration?.currentRevision;
  const origins = Object.fromEntries(
    pricingConfigurationParameterNames.map((parameter) => [
      parameter,
      originToForm(revision?.parameterOrigins[parameter]),
    ]),
  ) as PricingConfigurationFormValues['origins'];

  return {
    currency: 'BRL',
    fixedCostMode: revision?.fixedCostMode ?? '',
    fixedCostRate: percentageFractionToInput(revision?.fixedCostRate ?? null),
    monthlyFixedCost: revision?.monthlyFixedCost ?? '',
    averageMonthlyRevenue: revision?.averageMonthlyRevenue ?? '',
    monthlyLaborCost: revision?.monthlyLaborCost ?? '',
    productiveHours: revision?.productiveHours ?? '',
    defaultDesiredMargin: percentageFractionToInput(revision?.defaultDesiredMargin ?? null),
    origins,
  };
}

function decimalOrNull(value: string): string | null {
  if (value.trim() === '') return null;
  return canonicalizeDecimalInput(value, { integerDigits: 13, scale: 6 });
}

function percentageOrNull(value: string): string | null {
  if (value.trim() === '') return null;
  return canonicalizePercentageInput(value);
}

function originFromForm(
  origin: PricingConfigurationFormValues['origins'][PricingConfigurationParameterName],
): PricingParameterOriginInput {
  return {
    origin: origin.origin,
    source: origin.source === '' ? null : origin.source,
    referenceId: origin.referenceId === '' ? null : origin.referenceId,
    periodStart: origin.periodStart === '' ? null : origin.periodStart,
    periodEnd: origin.periodEnd === '' ? null : origin.periodEnd,
    criterion: origin.criterion === '' ? null : origin.criterion,
    measuredAt: origin.measuredAt === '' ? null : origin.measuredAt,
  };
}

function originChanged(
  origin: PricingConfigurationFormValues['origins'][PricingConfigurationParameterName],
  persisted: PricingParameterOriginResponse | undefined,
): boolean {
  const previous = originToForm(persisted);

  return (
    origin.origin !== previous.origin ||
    origin.source !== previous.source ||
    origin.referenceId !== previous.referenceId ||
    origin.periodStart !== previous.periodStart ||
    origin.periodEnd !== previous.periodEnd ||
    origin.criterion !== previous.criterion ||
    origin.measuredAt !== previous.measuredAt
  );
}

export interface PricingConfigurationPatchResult {
  input: UpdatePricingConfigurationInput;
  changed: boolean;
}

export function buildPricingConfigurationPatch(
  values: PricingConfigurationFormValues,
  configuration: PricingConfiguration | null,
): PricingConfigurationPatchResult {
  const current = configuration?.currentRevision;
  const resolved = {
    fixedCostMode: values.fixedCostMode === '' ? null : values.fixedCostMode,
    fixedCostRate: values.fixedCostMode === 'RATE' ? percentageOrNull(values.fixedCostRate) : null,
    monthlyFixedCost:
      values.fixedCostMode === 'MONTHLY' ? decimalOrNull(values.monthlyFixedCost) : null,
    averageMonthlyRevenue:
      values.fixedCostMode === 'MONTHLY' ? decimalOrNull(values.averageMonthlyRevenue) : null,
    monthlyLaborCost: decimalOrNull(values.monthlyLaborCost),
    productiveHours: decimalOrNull(values.productiveHours),
    defaultDesiredMargin: percentageOrNull(values.defaultDesiredMargin),
  };
  const input: UpdatePricingConfigurationInput = {
    expectedRevision: current?.revision ?? null,
  };
  const parameterOrigins: Partial<
    Record<PricingConfigurationParameterName, PricingParameterOriginInput>
  > = {};

  if (!current) {
    input.currency = 'BRL';
  }

  for (const parameter of pricingConfigurationParameterNames) {
    const previous = current?.[parameter] ?? null;
    const next = resolved[parameter];
    const valueChanged = (!current && next !== null) || (current && previous !== next);
    const provenanceChanged =
      current !== undefined &&
      next !== null &&
      originChanged(values.origins[parameter], current.parameterOrigins[parameter]);

    if (valueChanged) {
      Object.assign(input, { [parameter]: next });
    }

    if (next !== null && (valueChanged || provenanceChanged)) {
      parameterOrigins[parameter] = originFromForm(values.origins[parameter]);
    }
  }

  if (Object.keys(parameterOrigins).length > 0) {
    input.parameterOrigins = parameterOrigins;
  }

  return {
    input,
    changed: current === undefined || Object.keys(input).some((key) => key !== 'expectedRevision'),
  };
}
