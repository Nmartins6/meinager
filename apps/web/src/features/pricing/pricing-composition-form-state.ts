import { z } from 'zod';

import {
  pricingIsoDateStringSchema,
  pricingParameterOriginSchema,
  type PricingParameterOriginInput,
  type PricingParameterOriginResponse,
} from './pricing-configuration-contracts';
import {
  pricingComponentCategorySchema,
  pricingComponentCostSourceSchema,
  pricingCompositionParameterNames,
  pricingFreightModeSchema,
  type PricingComposition,
  type PricingCompositionParameterName,
  type PutPricingCompositionInput,
} from './pricing-composition-contracts';
import {
  canonicalizeDecimalInput,
  canonicalizePercentageInput,
  percentageFractionToInput,
} from './format-pricing';

const originFormSchema = z.strictObject({
  origin: z.union([z.literal(''), pricingParameterOriginSchema]),
  source: z.string(),
  referenceId: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  criterion: z.string(),
  measuredAt: z.string(),
});

const componentOriginFormSchema = z.strictObject({
  source: z.string(),
  referenceId: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  criterion: z.string(),
  measuredAt: z.string(),
});

const componentFormSchema = z.strictObject({
  description: z.string().trim().min(1, 'Informe a descrição.').max(160),
  category: pricingComponentCategorySchema,
  unit: z.string().trim().min(1, 'Informe a unidade.').max(20),
  quantity: z.string().min(1, 'Informe a quantidade.'),
  costSource: pricingComponentCostSourceSchema,
  storedUnitCost: z.string(),
  sourceProductId: z.string(),
  originDetails: componentOriginFormSchema,
});

const originFormShape = Object.fromEntries(
  pricingCompositionParameterNames.map((name) => [name, originFormSchema]),
) as Record<PricingCompositionParameterName, typeof originFormSchema>;

const pricingCompositionFormBaseSchema = z.strictObject({
  profileId: z.string(),
  desiredMargin: z.string(),
  laborEnabled: z.boolean(),
  timeMinutes: z.string(),
  freightMode: z.union([z.literal(''), pricingFreightModeSchema]),
  freightUnitCost: z.string(),
  freightTotalCost: z.string(),
  freightQuantity: z.string(),
  freightConsumedQuantity: z.string(),
  parameterOrigins: z.strictObject(originFormShape),
  components: z.array(componentFormSchema),
});

export type PricingCompositionFormValues = z.infer<typeof pricingCompositionFormBaseSchema>;

function invalidDecimal(value: string): boolean {
  return (
    value.trim() !== '' && canonicalizeDecimalInput(value, { integerDigits: 13, scale: 6 }) === null
  );
}

function validateOrigin(
  origin: PricingCompositionFormValues['parameterOrigins'][PricingCompositionParameterName],
  path: Array<string | number>,
  context: z.RefinementCtx,
) {
  const metadata = [
    origin.source,
    origin.referenceId,
    origin.periodStart,
    origin.periodEnd,
    origin.criterion,
    origin.measuredAt,
  ];
  if (origin.origin === '' && metadata.some((value) => value !== '')) {
    context.addIssue({ code: 'custom', path: [...path, 'origin'], message: 'Selecione a origem.' });
  }
  for (const field of ['periodStart', 'periodEnd', 'measuredAt'] as const) {
    if (origin[field] !== '' && !pricingIsoDateStringSchema.safeParse(origin[field]).success) {
      context.addIssue({
        code: 'custom',
        path: [...path, field],
        message: 'Informe uma data ISO 8601 válida.',
      });
    }
  }
}

function validateComponentOrigin(
  origin: PricingCompositionFormValues['components'][number]['originDetails'],
  path: Array<string | number>,
  context: z.RefinementCtx,
) {
  for (const field of ['periodStart', 'periodEnd', 'measuredAt'] as const) {
    if (origin[field] !== '' && !pricingIsoDateStringSchema.safeParse(origin[field]).success) {
      context.addIssue({
        code: 'custom',
        path: [...path, field],
        message: 'Informe uma data ISO 8601 válida.',
      });
    }
  }
}

export function createPricingCompositionFormSchema(productId: string) {
  return pricingCompositionFormBaseSchema.superRefine((values, context) => {
    if (values.profileId !== '' && !z.string().uuid().safeParse(values.profileId).success) {
      context.addIssue({
        code: 'custom',
        path: ['profileId'],
        message: 'Selecione um perfil válido.',
      });
    }
    if (values.desiredMargin !== '' && canonicalizePercentageInput(values.desiredMargin) === null) {
      context.addIssue({
        code: 'custom',
        path: ['desiredMargin'],
        message: 'Informe uma margem válida dentro do limite aceito.',
      });
    }
    if (values.laborEnabled && values.timeMinutes.trim() === '') {
      context.addIssue({
        code: 'custom',
        path: ['timeMinutes'],
        message: 'Informe o tempo de produção ou execução.',
      });
    } else if (invalidDecimal(values.timeMinutes)) {
      context.addIssue({
        code: 'custom',
        path: ['timeMinutes'],
        message: 'Informe um tempo não negativo com até seis casas decimais.',
      });
    }
    const freightFields = [
      'freightUnitCost',
      'freightTotalCost',
      'freightQuantity',
      'freightConsumedQuantity',
    ] as const;
    for (const field of freightFields) {
      if (invalidDecimal(values[field])) {
        context.addIssue({
          code: 'custom',
          path: [field],
          message: 'Informe um valor não negativo com até seis casas decimais.',
        });
      }
    }
    if (values.freightMode === 'MANUAL' && values.freightUnitCost.trim() === '') {
      context.addIssue({
        code: 'custom',
        path: ['freightUnitCost'],
        message: 'Informe o custo unitário do frete.',
      });
    }
    if (values.freightMode === 'ALLOCATED') {
      if (values.freightTotalCost.trim() === '') {
        context.addIssue({
          code: 'custom',
          path: ['freightTotalCost'],
          message: 'Informe o custo total do frete.',
        });
      }
      const quantity = canonicalizeDecimalInput(values.freightQuantity, {
        integerDigits: 13,
        scale: 6,
      });
      if (quantity === null || quantity === '0') {
        context.addIssue({
          code: 'custom',
          path: ['freightQuantity'],
          message: 'Informe uma quantidade de rateio maior que zero.',
        });
      }
    }
    for (const parameter of pricingCompositionParameterNames) {
      validateOrigin(values.parameterOrigins[parameter], ['parameterOrigins', parameter], context);
    }
    values.components.forEach((component, index) => {
      if (canonicalizeDecimalInput(component.quantity, { integerDigits: 13, scale: 6 }) === null) {
        context.addIssue({
          code: 'custom',
          path: ['components', index, 'quantity'],
          message: 'Informe uma quantidade não negativa com até seis casas decimais.',
        });
      }
      if (component.costSource === 'CATALOG') {
        if (component.sourceProductId === '') {
          context.addIssue({
            code: 'custom',
            path: ['components', index, 'sourceProductId'],
            message: 'Selecione um produto do catálogo.',
          });
        } else if (!z.string().uuid().safeParse(component.sourceProductId).success) {
          context.addIssue({
            code: 'custom',
            path: ['components', index, 'sourceProductId'],
            message: 'Selecione um produto válido do catálogo.',
          });
        } else if (component.sourceProductId === productId) {
          context.addIssue({
            code: 'custom',
            path: ['components', index, 'sourceProductId'],
            message: 'Um produto não pode referenciar a si próprio.',
          });
        }
      } else if (
        component.storedUnitCost.trim() === '' ||
        canonicalizeDecimalInput(component.storedUnitCost, {
          integerDigits: 13,
          scale: 6,
        }) === null
      ) {
        context.addIssue({
          code: 'custom',
          path: ['components', index, 'storedUnitCost'],
          message: 'Informe o custo unitário persistido.',
        });
      }
      validateComponentOrigin(
        component.originDetails,
        ['components', index, 'originDetails'],
        context,
      );
    });
  });
}

export const emptyPricingCompositionComponent: PricingCompositionFormValues['components'][number] =
  {
    description: '',
    category: 'MATERIAL',
    unit: 'UN',
    quantity: '1',
    costSource: 'MANUAL',
    storedUnitCost: '',
    sourceProductId: '',
    originDetails: {
      source: '',
      referenceId: '',
      periodStart: '',
      periodEnd: '',
      criterion: '',
      measuredAt: '',
    },
  };

function originToForm(origin: PricingParameterOriginResponse | undefined) {
  return {
    origin: origin?.origin ?? '',
    source: origin?.source ?? '',
    referenceId: origin?.referenceId ?? '',
    periodStart: origin?.periodStart ?? '',
    periodEnd: origin?.periodEnd ?? '',
    criterion: origin?.criterion ?? '',
    measuredAt: origin?.measuredAt ?? '',
  };
}

export function pricingCompositionToFormValues(
  composition: PricingComposition | null,
): PricingCompositionFormValues {
  const origins = Object.fromEntries(
    pricingCompositionParameterNames.map((name) => [
      name,
      originToForm(composition?.parameterOrigins[name]),
    ]),
  ) as PricingCompositionFormValues['parameterOrigins'];
  return {
    profileId: composition?.profileId ?? '',
    desiredMargin: percentageFractionToInput(composition?.desiredMargin ?? null),
    laborEnabled: composition?.laborEnabled ?? false,
    timeMinutes: composition?.timeMinutes ?? '',
    freightMode: composition?.freightMode ?? '',
    freightUnitCost: composition?.freightUnitCost ?? '',
    freightTotalCost: composition?.freightTotalCost ?? '',
    freightQuantity: composition?.freightQuantity ?? '',
    freightConsumedQuantity: composition?.freightConsumedQuantity ?? '',
    parameterOrigins: origins,
    components:
      composition?.components.map((component) => ({
        description: component.description,
        category: component.category,
        unit: component.unit,
        quantity: component.quantity,
        costSource: component.costSource,
        storedUnitCost: component.storedUnitCost ?? '',
        sourceProductId: component.sourceProductId ?? '',
        originDetails: {
          source: component.originDetails.source ?? '',
          referenceId: component.originDetails.referenceId ?? '',
          periodStart: component.originDetails.periodStart ?? '',
          periodEnd: component.originDetails.periodEnd ?? '',
          criterion: component.originDetails.criterion ?? '',
          measuredAt: component.originDetails.measuredAt ?? '',
        },
      })) ?? [],
  };
}

function decimalOrNull(value: string): string | null {
  return value.trim() === ''
    ? null
    : canonicalizeDecimalInput(value, { integerDigits: 13, scale: 6 });
}

function nullable(value: string): string | null {
  return value === '' ? null : value;
}

function originFromForm(
  origin: PricingCompositionFormValues['parameterOrigins'][PricingCompositionParameterName],
): PricingParameterOriginInput | undefined {
  if (origin.origin === '') return undefined;
  return {
    origin: origin.origin,
    source: nullable(origin.source),
    referenceId: nullable(origin.referenceId),
    periodStart: nullable(origin.periodStart),
    periodEnd: nullable(origin.periodEnd),
    criterion: nullable(origin.criterion),
    measuredAt: nullable(origin.measuredAt),
  };
}

function parameterApplicable(
  name: PricingCompositionParameterName,
  values: PricingCompositionFormValues,
) {
  if (name === 'laborEnabled') return true;
  if (name === 'desiredMargin') return values.desiredMargin.trim() !== '';
  if (name === 'timeMinutes') return values.laborEnabled;
  if (name === 'freightMode') return values.freightMode !== '';
  if (name === 'freightUnitCost') return values.freightMode === 'MANUAL';
  if (name === 'freightTotalCost' || name === 'freightQuantity') {
    return values.freightMode === 'ALLOCATED';
  }
  return values.freightMode === 'ALLOCATED' && values.freightConsumedQuantity.trim() !== '';
}

function stable(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
    .join(',')}}`;
}

export function buildPricingCompositionInput(
  values: PricingCompositionFormValues,
  composition: PricingComposition | null,
): { input: PutPricingCompositionInput; changed: boolean } {
  const parameterOrigins: PutPricingCompositionInput['parameterOrigins'] = {};
  for (const name of pricingCompositionParameterNames) {
    if (!parameterApplicable(name, values)) continue;
    const origin = originFromForm(values.parameterOrigins[name]);
    if (origin) parameterOrigins[name] = origin;
  }
  const input: PutPricingCompositionInput = {
    expectedRevision: composition?.revision ?? null,
    profileId: values.profileId === '' ? null : values.profileId,
    desiredMargin:
      values.desiredMargin.trim() === '' ? null : canonicalizePercentageInput(values.desiredMargin),
    laborEnabled: values.laborEnabled,
    timeMinutes: values.laborEnabled ? decimalOrNull(values.timeMinutes) : null,
    freightMode: values.freightMode === '' ? null : values.freightMode,
    freightUnitCost: values.freightMode === 'MANUAL' ? decimalOrNull(values.freightUnitCost) : null,
    freightTotalCost:
      values.freightMode === 'ALLOCATED' ? decimalOrNull(values.freightTotalCost) : null,
    freightQuantity:
      values.freightMode === 'ALLOCATED' ? decimalOrNull(values.freightQuantity) : null,
    freightConsumedQuantity:
      values.freightMode === 'ALLOCATED' ? decimalOrNull(values.freightConsumedQuantity) : null,
    parameterOrigins,
    components: values.components.map((component) => ({
      description: component.description.trim(),
      category: component.category,
      unit: component.unit.trim(),
      quantity: canonicalizeDecimalInput(component.quantity, {
        integerDigits: 13,
        scale: 6,
      })!,
      costSource: component.costSource,
      ...(component.costSource === 'CATALOG'
        ? { sourceProductId: component.sourceProductId }
        : {
            storedUnitCost: canonicalizeDecimalInput(component.storedUnitCost, {
              integerDigits: 13,
              scale: 6,
            })!,
          }),
      originDetails: {
        source: nullable(component.originDetails.source),
        referenceId: nullable(component.originDetails.referenceId),
        periodStart: nullable(component.originDetails.periodStart),
        periodEnd: nullable(component.originDetails.periodEnd),
        criterion: nullable(component.originDetails.criterion),
        measuredAt: nullable(component.originDetails.measuredAt),
      },
    })),
  };
  if (!composition) return { input, changed: true };
  const previous = buildPricingCompositionInput(
    pricingCompositionToFormValues(composition),
    null,
  ).input;
  return {
    input,
    changed:
      stable({ ...input, expectedRevision: null }) !==
      stable({ ...previous, expectedRevision: null }),
  };
}
