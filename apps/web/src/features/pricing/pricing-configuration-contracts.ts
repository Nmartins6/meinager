import { z } from 'zod';

import { pricingDecimalStringSchema } from './pricing-contracts';

export const pricingFixedCostModeSchema = z.enum(['RATE', 'MONTHLY']);
export const pricingParameterOriginSchema = z.enum(['MANUAL', 'FINANCIAL_AGGREGATE', 'COPIED']);

export const pricingConfigurationParameterNames = [
  'fixedCostMode',
  'fixedCostRate',
  'monthlyFixedCost',
  'averageMonthlyRevenue',
  'monthlyLaborCost',
  'productiveHours',
  'defaultDesiredMargin',
] as const;

export type PricingConfigurationParameterName = (typeof pricingConfigurationParameterNames)[number];

function decimalSchema(integerDigits: number, scale: number) {
  return pricingDecimalStringSchema.refine((value) => {
    const [integer, fraction = ''] = value.split('.');
    return integer.length <= integerDigits && fraction.length <= scale;
  }, `Use até ${integerDigits} dígitos inteiros e ${scale} casas decimais.`);
}

const rateDecimalSchema = decimalSchema(4, 8);
const valueDecimalSchema = decimalSchema(13, 6);
const optionalOriginTextSchema = z.string().nullable().optional();
export const pricingIsoDateStringSchema = z
  .string()
  .refine(
    (value) =>
      z.iso.date().safeParse(value).success ||
      z.iso.datetime({ offset: true, local: true }).safeParse(value).success,
    'Informe uma data ISO 8601 válida.',
  );
const optionalOriginDateSchema = pricingIsoDateStringSchema.nullable().optional();

export const pricingParameterOriginInputSchema = z.strictObject({
  origin: pricingParameterOriginSchema,
  source: optionalOriginTextSchema,
  referenceId: optionalOriginTextSchema,
  periodStart: optionalOriginDateSchema,
  periodEnd: optionalOriginDateSchema,
  criterion: optionalOriginTextSchema,
  measuredAt: optionalOriginDateSchema,
});

export const pricingParameterOriginResponseSchema = z.strictObject({
  schemaVersion: z.literal(1),
  origin: pricingParameterOriginSchema,
  source: z.string().nullable(),
  referenceId: z.string().nullable(),
  periodStart: pricingIsoDateStringSchema.nullable(),
  periodEnd: pricingIsoDateStringSchema.nullable(),
  criterion: z.string().nullable(),
  measuredAt: pricingIsoDateStringSchema.nullable(),
  confirmedByUserId: z.string().uuid(),
});

const configurationOriginsInputShape = Object.fromEntries(
  pricingConfigurationParameterNames.map((parameter) => [
    parameter,
    pricingParameterOriginInputSchema.optional(),
  ]),
) as Record<
  PricingConfigurationParameterName,
  z.ZodOptional<typeof pricingParameterOriginInputSchema>
>;

const configurationOriginsResponseShape = Object.fromEntries(
  pricingConfigurationParameterNames.map((parameter) => [
    parameter,
    pricingParameterOriginResponseSchema.optional(),
  ]),
) as Record<
  PricingConfigurationParameterName,
  z.ZodOptional<typeof pricingParameterOriginResponseSchema>
>;

export const pricingConfigurationOriginsInputSchema = z.strictObject(
  configurationOriginsInputShape,
);

export const pricingConfigurationOriginsResponseSchema = z.strictObject(
  configurationOriginsResponseShape,
);

export const pricingConfigurationSchema = z.strictObject({
  id: z.string().uuid(),
  isActive: z.boolean(),
  currentRevision: z.strictObject({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    effectiveFrom: z.iso.datetime({ offset: true }),
    currency: z.literal('BRL'),
    fixedCostMode: pricingFixedCostModeSchema.nullable(),
    fixedCostRate: rateDecimalSchema.nullable(),
    monthlyFixedCost: valueDecimalSchema.nullable(),
    averageMonthlyRevenue: valueDecimalSchema.nullable(),
    monthlyLaborCost: valueDecimalSchema.nullable(),
    productiveHours: valueDecimalSchema.nullable(),
    defaultDesiredMargin: rateDecimalSchema.nullable(),
    parameterOrigins: pricingConfigurationOriginsResponseSchema,
    createdAt: z.iso.datetime({ offset: true }),
  }),
});

export const updatePricingConfigurationInputSchema = z.strictObject({
  expectedRevision: z.number().int().positive().nullable(),
  currency: z.literal('BRL').optional(),
  fixedCostMode: pricingFixedCostModeSchema.nullable().optional(),
  fixedCostRate: rateDecimalSchema.nullable().optional(),
  monthlyFixedCost: valueDecimalSchema.nullable().optional(),
  averageMonthlyRevenue: valueDecimalSchema.nullable().optional(),
  monthlyLaborCost: valueDecimalSchema.nullable().optional(),
  productiveHours: valueDecimalSchema.nullable().optional(),
  defaultDesiredMargin: rateDecimalSchema.nullable().optional(),
  parameterOrigins: pricingConfigurationOriginsInputSchema.optional(),
});

export type PricingFixedCostMode = z.infer<typeof pricingFixedCostModeSchema>;
export type PricingParameterOrigin = z.infer<typeof pricingParameterOriginSchema>;
export type PricingParameterOriginInput = z.infer<typeof pricingParameterOriginInputSchema>;
export type PricingParameterOriginResponse = z.infer<typeof pricingParameterOriginResponseSchema>;
export type PricingConfiguration = z.infer<typeof pricingConfigurationSchema>;
export type UpdatePricingConfigurationInput = z.infer<typeof updatePricingConfigurationInputSchema>;
