import { z } from 'zod';

import { pricingCommercialPriceStringSchema } from './pricing-contracts';

const uuid = z.string().uuid();
const price = pricingCommercialPriceStringSchema;

export const pricingAdoptionInputSchema = z.union([
  z.strictObject({ versionId: uuid }),
  z.strictObject({
    versionId: uuid,
    belowMinimumConfirmed: z.literal(true),
    justification: z.string().trim().min(1),
  }),
]);

export const pricingAdoptionResponseSchema = z.strictObject({
  product: z.strictObject({
    id: uuid,
    currency: z.literal('BRL'),
    salePrice: price,
    adoptedPricingVersionId: uuid,
  }),
  adoption: z.strictObject({
    id: uuid,
    productId: uuid,
    versionId: uuid,
    previousVersionId: uuid.nullable(),
    previousPrice: price.nullable(),
    newPrice: price,
    classification: z.enum([
      'BELOW_MINIMUM',
      'COST_COVERAGE',
      'BELOW_DESIRED_MARGIN',
      'DESIRED_MARGIN_MET',
      'ABOVE_DESIRED_MARGIN',
    ]),
    belowMinimumConfirmed: z.boolean(),
    justification: z.string().nullable(),
    createdByUserId: uuid,
    createdAt: z.iso.datetime({ offset: true }),
  }),
});

export type PricingAdoptionInput = z.infer<typeof pricingAdoptionInputSchema>;
