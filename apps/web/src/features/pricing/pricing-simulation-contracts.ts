import { z } from 'zod';

import { pricingParameterOriginSchema } from './pricing-configuration-contracts';
import {
  pricingComponentCategorySchema,
  pricingCompositionComponentInputSchema,
  pricingCompositionOriginsInputSchema,
  pricingCompositionRateSchema,
  pricingCompositionValueSchema,
  pricingFreightModeSchema,
} from './pricing-composition-contracts';
import { pricingDecimalStringSchema } from './pricing-contracts';

const signedDecimalStringSchema = z
  .string()
  .regex(/^-?(?:0|[1-9]\d*)(?:\.\d*[1-9])?$/, 'Informe um decimal canônico sem expoente.')
  .refine((value) => value !== '-0', 'Zero deve ser representado sem sinal.');
const displayMoneySchema = z
  .string()
  .regex(/^-?(?:0|[1-9]\d*)\.\d{2}$/, 'Informe um valor monetário com duas casas.');
const commercialPriceSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*)\.\d{2}$/, 'Informe um preço comercial com duas casas.');

const simulationDraftSchema = z.strictObject({
  profileId: z.string().uuid().nullable(),
  desiredMargin: pricingCompositionRateSchema.nullable(),
  laborEnabled: z.boolean(),
  timeMinutes: pricingCompositionValueSchema.nullable(),
  freightMode: pricingFreightModeSchema.nullable(),
  freightUnitCost: pricingCompositionValueSchema.nullable(),
  freightTotalCost: pricingCompositionValueSchema.nullable(),
  freightQuantity: pricingCompositionValueSchema.nullable(),
  freightConsumedQuantity: pricingCompositionValueSchema.nullable(),
  parameterOrigins: pricingCompositionOriginsInputSchema,
  components: z.array(pricingCompositionComponentInputSchema),
});

export const persistedPricingSimulationInputSchema = z.strictObject({
  source: z.literal('PERSISTED'),
  adoptedPrice: pricingDecimalStringSchema.optional(),
});

export const draftPricingSimulationInputSchema = z.strictObject({
  source: z.literal('DRAFT'),
  draft: simulationDraftSchema,
  adoptedPrice: pricingDecimalStringSchema.optional(),
});

export const pricingSimulationInputSchema = z.discriminatedUnion('source', [
  persistedPricingSimulationInputSchema,
  draftPricingSimulationInputSchema,
]);

const componentInputSchema = z.strictObject({
  description: z.string(),
  category: pricingComponentCategorySchema,
  unit: z.string(),
  quantity: pricingDecimalStringSchema,
  unitCost: pricingDecimalStringSchema,
  origin: z.enum(['MANUAL', 'CATALOG', 'COPIED']),
  productId: z.string().uuid().optional(),
});

const deductionInputSchema = z.strictObject({
  name: z.string(),
  category: z.string(),
  rate: pricingDecimalStringSchema,
  origin: pricingParameterOriginSchema,
});

const fixedCostsInputSchema = z.discriminatedUnion('mode', [
  z.strictObject({
    mode: z.literal('RATE'),
    rate: pricingDecimalStringSchema,
    origin: pricingParameterOriginSchema,
  }),
  z.strictObject({
    mode: z.literal('MONTHLY'),
    monthlyCost: pricingDecimalStringSchema,
    averageRevenue: pricingDecimalStringSchema,
    origin: pricingParameterOriginSchema,
  }),
]);

const laborInputSchema = z.strictObject({
  monthlyCost: pricingDecimalStringSchema,
  productiveHours: pricingDecimalStringSchema,
  timeMinutes: pricingDecimalStringSchema,
});

const freightInputSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('MANUAL'), unitCost: pricingDecimalStringSchema }),
  z.strictObject({
    mode: z.literal('ALLOCATED'),
    totalCost: pricingDecimalStringSchema,
    quantity: pricingDecimalStringSchema,
    consumedQuantity: pricingDecimalStringSchema.optional(),
  }),
]);

const resolvedInputSchema = z.strictObject({
  currency: z.literal('BRL'),
  components: z.array(componentInputSchema),
  labor: laborInputSchema.optional(),
  freight: freightInputSchema.optional(),
  fixedCosts: fixedCostsInputSchema.optional(),
  deductions: z.array(deductionInputSchema),
  desiredMargin: pricingDecimalStringSchema,
  adoptedPrice: pricingDecimalStringSchema.optional(),
});

const moneySchema = z.strictObject({
  exact: signedDecimalStringSchema,
  display: displayMoneySchema,
});
const priceSchema = z.strictObject({
  exact: pricingDecimalStringSchema,
  commercial: commercialPriceSchema,
});
const resultComponentSchema = componentInputSchema.extend({ total: moneySchema });
const resultDeductionSchema = deductionInputSchema.extend({ amount: moneySchema });
const resultLaborSchema = laborInputSchema.extend({
  costPerHour: moneySchema,
  costPerMinute: moneySchema,
  total: moneySchema,
});
const resultFreightSchema = z.discriminatedUnion('mode', [
  z.strictObject({
    mode: z.literal('MANUAL'),
    unitCost: pricingDecimalStringSchema,
    costPerLotUnit: moneySchema,
    total: moneySchema,
  }),
  z.strictObject({
    mode: z.literal('ALLOCATED'),
    totalCost: pricingDecimalStringSchema,
    quantity: pricingDecimalStringSchema,
    consumedQuantity: pricingDecimalStringSchema,
    costPerLotUnit: moneySchema,
    total: moneySchema,
  }),
]);

export const pricingCalculatorResultSchema = z.strictObject({
  formulaVersion: z.literal('margin-divisor-v1'),
  currency: z.literal('BRL'),
  components: z.array(resultComponentSchema),
  labor: resultLaborSchema.nullable(),
  freight: resultFreightSchema.nullable(),
  fixedCosts: z.strictObject({
    input: fixedCostsInputSchema.nullable(),
    rate: pricingDecimalStringSchema,
  }),
  deductions: z.array(deductionInputSchema),
  totalDeductionRate: pricingDecimalStringSchema,
  desiredMargin: pricingDecimalStringSchema,
  baseCost: moneySchema,
  minimumPrice: priceSchema,
  suggestedPrice: priceSchema,
  adoptedPrice: commercialPriceSchema.nullable(),
  analysis: z.strictObject({
    price: commercialPriceSchema,
    fixedCosts: moneySchema,
    deductions: z.array(resultDeductionSchema),
    totalDeductions: moneySchema,
    profit: moneySchema,
    effectiveMargin: signedDecimalStringSchema.nullable(),
    differenceFromSuggestedExact: moneySchema,
    classification: z.enum([
      'BELOW_MINIMUM',
      'COST_COVERAGE',
      'BELOW_DESIRED_MARGIN',
      'DESIRED_MARGIN_MET',
      'ABOVE_DESIRED_MARGIN',
    ]),
  }),
  maximumDiscountRate: signedDecimalStringSchema.nullable(),
  warnings: z.array(
    z.strictObject({
      code: z.enum(['BELOW_MINIMUM', 'BELOW_DESIRED_MARGIN']),
      message: z.string(),
    }),
  ),
});

export const pricingSimulationResponseSchema = z.strictObject({
  productId: z.string().uuid(),
  source: z.enum(['PERSISTED', 'DRAFT']),
  compositionRevision: z.number().int().positive().nullable(),
  configuration: z.strictObject({
    id: z.string().uuid(),
    revisionId: z.string().uuid(),
    revision: z.number().int().positive(),
  }),
  profile: z
    .strictObject({
      id: z.string().uuid(),
      revisionId: z.string().uuid(),
      revision: z.number().int().positive(),
      name: z.string(),
    })
    .nullable(),
  effectiveDesiredMargin: z.strictObject({
    value: pricingDecimalStringSchema,
    precedence: z.enum(['COMPOSITION', 'CONFIGURATION']),
    origin: pricingParameterOriginSchema.nullable(),
  }),
  resolvedInput: resolvedInputSchema,
  result: pricingCalculatorResultSchema,
  formulaVersion: z.literal('margin-divisor-v1'),
  adoptedPrice: commercialPriceSchema.nullable(),
});

export type PricingSimulationInput = z.infer<typeof pricingSimulationInputSchema>;
export type PricingSimulationResponse = z.infer<typeof pricingSimulationResponseSchema>;
