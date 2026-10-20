import { z } from 'zod';

import {
  pricingParameterOriginInputSchema,
  pricingParameterOriginResponseSchema,
} from './pricing-configuration-contracts';
import { pricingDecimalStringSchema } from './pricing-contracts';
import {
  pricingDeductionOriginInputSchema,
  pricingDeductionOriginResponseSchema,
} from './pricing-profiles-contracts';

export const pricingComponentCategorySchema = z.enum([
  'DIRECT_COST',
  'MATERIAL',
  'PACKAGING',
  'LABOR',
  'FREIGHT',
  'OUTSOURCING',
  'LOSS',
  'OTHER',
]);
export const pricingComponentCostSourceSchema = z.enum(['MANUAL', 'COPIED', 'CATALOG']);
export const pricingFreightModeSchema = z.enum(['MANUAL', 'ALLOCATED']);

function decimalSchema(integerDigits: number, scale: number) {
  return pricingDecimalStringSchema.refine((value) => {
    const [integer, fraction = ''] = value.split('.');
    return integer.length <= integerDigits && fraction.length <= scale;
  }, `Use até ${integerDigits} dígitos inteiros e ${scale} casas decimais.`);
}

export const pricingCompositionValueSchema = decimalSchema(13, 6);
export const pricingCompositionRateSchema = decimalSchema(4, 8);

export const pricingCompositionParameterNames = [
  'desiredMargin',
  'laborEnabled',
  'timeMinutes',
  'freightMode',
  'freightUnitCost',
  'freightTotalCost',
  'freightQuantity',
  'freightConsumedQuantity',
] as const;

export type PricingCompositionParameterName = (typeof pricingCompositionParameterNames)[number];

const originInputShape = Object.fromEntries(
  pricingCompositionParameterNames.map((name) => [
    name,
    pricingParameterOriginInputSchema.optional(),
  ]),
) as Record<
  PricingCompositionParameterName,
  z.ZodOptional<typeof pricingParameterOriginInputSchema>
>;

const originResponseShape = Object.fromEntries(
  pricingCompositionParameterNames.map((name) => [
    name,
    pricingParameterOriginResponseSchema.optional(),
  ]),
) as Record<
  PricingCompositionParameterName,
  z.ZodOptional<typeof pricingParameterOriginResponseSchema>
>;

export const pricingCompositionOriginsInputSchema = z.strictObject(originInputShape);
export const pricingCompositionOriginsResponseSchema = z.strictObject(originResponseShape);

const componentInputBaseSchema = z.strictObject({
  description: z.string().trim().min(1).max(160),
  category: pricingComponentCategorySchema,
  unit: z.string().trim().min(1).max(20),
  quantity: pricingCompositionValueSchema,
  costSource: pricingComponentCostSourceSchema,
  storedUnitCost: pricingCompositionValueSchema.nullable().optional(),
  sourceProductId: z.string().uuid().nullable().optional(),
  originDetails: pricingDeductionOriginInputSchema.optional(),
});

export const pricingCompositionComponentInputSchema = componentInputBaseSchema.superRefine(
  (component, context) => {
    if (component.costSource === 'CATALOG') {
      if (component.storedUnitCost !== undefined) {
        context.addIssue({
          code: 'custom',
          path: ['storedUnitCost'],
          message: 'Componentes de catálogo não aceitam custo persistido.',
        });
      }
      if (!component.sourceProductId) {
        context.addIssue({
          code: 'custom',
          path: ['sourceProductId'],
          message: 'Selecione um produto do catálogo.',
        });
      }
      return;
    }
    if (component.storedUnitCost == null) {
      context.addIssue({
        code: 'custom',
        path: ['storedUnitCost'],
        message: 'Informe o custo unitário persistido.',
      });
    }
    if (component.sourceProductId != null) {
      context.addIssue({
        code: 'custom',
        path: ['sourceProductId'],
        message: 'Esta origem não aceita referência de catálogo.',
      });
    }
  },
);

const pricingCompositionComponentSchema = z
  .strictObject({
    id: z.string().uuid(),
    position: z.number().int().positive(),
    description: z.string().min(1).max(160),
    category: pricingComponentCategorySchema,
    unit: z.string().min(1).max(20),
    quantity: pricingCompositionValueSchema,
    costSource: pricingComponentCostSourceSchema,
    storedUnitCost: pricingCompositionValueSchema.nullable(),
    sourceProductId: z.string().uuid().nullable(),
    originDetails: pricingDeductionOriginResponseSchema,
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .superRefine((component, context) => {
    const catalog = component.costSource === 'CATALOG';
    if (catalog !== (component.storedUnitCost === null)) {
      context.addIssue({
        code: 'custom',
        path: ['storedUnitCost'],
        message: 'O custo persistido é incompatível com a origem.',
      });
    }
    if (catalog !== (component.sourceProductId !== null)) {
      context.addIssue({
        code: 'custom',
        path: ['sourceProductId'],
        message: 'A referência de catálogo é incompatível com a origem.',
      });
    }
  });

function addConditionalIssues(
  value: {
    laborEnabled: boolean;
    timeMinutes: string | null;
    freightMode: 'MANUAL' | 'ALLOCATED' | null;
    freightUnitCost: string | null;
    freightTotalCost: string | null;
    freightQuantity: string | null;
    freightConsumedQuantity: string | null;
  },
  context: z.RefinementCtx,
) {
  if (value.laborEnabled !== (value.timeMinutes !== null)) {
    context.addIssue({
      code: 'custom',
      path: ['timeMinutes'],
      message: value.laborEnabled
        ? 'Informe o tempo quando a mão de obra estiver habilitada.'
        : 'Remova o tempo quando a mão de obra estiver desabilitada.',
    });
  }
  if (value.freightMode === null) {
    if (
      value.freightUnitCost !== null ||
      value.freightTotalCost !== null ||
      value.freightQuantity !== null ||
      value.freightConsumedQuantity !== null
    ) {
      context.addIssue({
        code: 'custom',
        path: ['freightMode'],
        message: 'Selecione um modo de frete.',
      });
    }
  } else if (value.freightMode === 'MANUAL') {
    if (
      value.freightUnitCost === null ||
      value.freightTotalCost !== null ||
      value.freightQuantity !== null ||
      value.freightConsumedQuantity !== null
    ) {
      context.addIssue({
        code: 'custom',
        path: ['freightUnitCost'],
        message: 'O frete manual aceita somente o custo unitário.',
      });
    }
  } else if (
    value.freightUnitCost !== null ||
    value.freightTotalCost === null ||
    value.freightQuantity === null ||
    value.freightQuantity === '0'
  ) {
    context.addIssue({
      code: 'custom',
      path: ['freightTotalCost'],
      message: 'O frete rateado exige custo total e quantidade maior que zero.',
    });
  }
}

function addOriginApplicabilityIssues(
  value: {
    desiredMargin: string | null;
    laborEnabled: boolean;
    timeMinutes: string | null;
    freightMode: 'MANUAL' | 'ALLOCATED' | null;
    freightConsumedQuantity: string | null;
    parameterOrigins: Partial<Record<PricingCompositionParameterName, unknown>>;
  },
  context: z.RefinementCtx,
) {
  const applicable: Record<PricingCompositionParameterName, boolean> = {
    desiredMargin: value.desiredMargin !== null,
    laborEnabled: true,
    timeMinutes: value.laborEnabled,
    freightMode: value.freightMode !== null,
    freightUnitCost: value.freightMode === 'MANUAL',
    freightTotalCost: value.freightMode === 'ALLOCATED',
    freightQuantity: value.freightMode === 'ALLOCATED',
    freightConsumedQuantity:
      value.freightMode === 'ALLOCATED' && value.freightConsumedQuantity !== null,
  };
  for (const name of pricingCompositionParameterNames) {
    if (!applicable[name] && value.parameterOrigins[name] !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['parameterOrigins', name],
        message: 'A origem não é aplicável ao parâmetro atual.',
      });
    }
  }
}

const compositionBaseShape = {
  profileId: z.string().uuid().nullable(),
  desiredMargin: pricingCompositionRateSchema.nullable(),
  laborEnabled: z.boolean(),
  timeMinutes: pricingCompositionValueSchema.nullable(),
  freightMode: pricingFreightModeSchema.nullable(),
  freightUnitCost: pricingCompositionValueSchema.nullable(),
  freightTotalCost: pricingCompositionValueSchema.nullable(),
  freightQuantity: pricingCompositionValueSchema.nullable(),
  freightConsumedQuantity: pricingCompositionValueSchema.nullable(),
};

export const putPricingCompositionInputSchema = z
  .strictObject({
    expectedRevision: z.number().int().positive().nullable(),
    ...compositionBaseShape,
    parameterOrigins: pricingCompositionOriginsInputSchema,
    components: z.array(pricingCompositionComponentInputSchema),
  })
  .superRefine((composition, context) => {
    addConditionalIssues(composition, context);
    addOriginApplicabilityIssues(composition, context);
  });

export const pricingCompositionSchema = z
  .strictObject({
    id: z.string().uuid(),
    productId: z.string().uuid(),
    revision: z.number().int().positive(),
    ...compositionBaseShape,
    parameterOrigins: pricingCompositionOriginsResponseSchema,
    isActive: z.boolean(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    components: z.array(pricingCompositionComponentSchema),
  })
  .superRefine((composition, context) => {
    addConditionalIssues(composition, context);
    addOriginApplicabilityIssues(composition, context);
    composition.components.forEach((component, index) => {
      if (component.position !== index + 1) {
        context.addIssue({
          code: 'custom',
          path: ['components', index, 'position'],
          message: 'As posições devem ser positivas, únicas e contíguas.',
        });
      }
    });
  });

export type PricingComposition = z.infer<typeof pricingCompositionSchema>;
export type PricingCompositionComponentInput = z.infer<
  typeof pricingCompositionComponentInputSchema
>;
export type PutPricingCompositionInput = z.infer<typeof putPricingCompositionInputSchema>;
