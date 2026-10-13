import { z } from 'zod';

export const pricingDecimalStringSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d*[1-9])?$/, 'Informe um valor decimal canônico não negativo.');

export const pricingCommercialPriceStringSchema = pricingDecimalStringSchema.refine((value) => {
  const [integer, fraction = ''] = value.split('.');
  return integer.length <= 12 && fraction.length <= 2;
}, 'Informe um preço representável com até 12 dígitos inteiros e duas casas decimais.');

export const pricingProductSummarySchema = z.strictObject({
  productId: z.string().uuid(),
  currency: z.literal('BRL'),
  salePrice: pricingCommercialPriceStringSchema.nullable(),
  priceOrigin: z.enum(['MANUAL', 'PRICING_VERSION']),
  hasComposition: z.boolean(),
});

export const pricingErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'INVALID_DECIMAL_VALUE',
  'NEGATIVE_VALUE',
  'UNSUPPORTED_CURRENCY',
  'AUTHENTICATION_REQUIRED',
  'PRICING_FORBIDDEN',
  'PRICING_CONFIGURATION_NOT_FOUND',
  'PRICING_CONFIGURATION_REQUIRED',
  'PRICING_PROFILE_NOT_FOUND',
  'PRICING_PROFILE_INACTIVE',
  'PRODUCT_NOT_FOUND',
  'PRICING_COMPOSITION_NOT_FOUND',
  'PRICING_VERSION_NOT_FOUND',
  'PRICING_VERSION_NOT_FINALIZED',
  'JUSTIFICATION_REQUIRED',
  'PRICE_OUT_OF_RANGE',
  'BELOW_MINIMUM_FORBIDDEN',
  'PRICING_REVISION_CONFLICT',
  'PRICING_CONCURRENT_MODIFICATION',
  'INVALID_AVERAGE_REVENUE',
  'INVALID_PRODUCTIVE_HOURS',
  'INVALID_FREIGHT_QUANTITY',
  'INVALID_PRICING_DIVISOR',
  'INTERNAL_ERROR',
]);

export const pricingErrorResponseSchema = z.strictObject({
  statusCode: z.number().int().min(400).max(599),
  message: z.string().min(1),
  code: pricingErrorCodeSchema,
  field: z.string().min(1).optional(),
  details: z
    .strictObject({
      expectedRevision: z.number().int().min(0),
      currentRevision: z.number().int().min(0),
    })
    .optional(),
});

export const manualProductPriceInputSchema = z.strictObject({
  salePrice: pricingCommercialPriceStringSchema.nullable(),
});

export type PricingProductSummary = z.infer<typeof pricingProductSummarySchema>;
export type PricingErrorCode = z.infer<typeof pricingErrorCodeSchema>;
export type PricingErrorResponse = z.infer<typeof pricingErrorResponseSchema>;
export type ManualProductPriceInput = z.infer<typeof manualProductPriceInputSchema>;
