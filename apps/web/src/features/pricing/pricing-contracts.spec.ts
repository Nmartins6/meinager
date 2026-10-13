import { describe, expect, it } from 'vitest';

import {
  manualProductPriceInputSchema,
  pricingCommercialPriceStringSchema,
  pricingErrorResponseSchema,
  pricingProductSummarySchema,
} from './pricing-contracts';

const summary = {
  productId: 'f25c7c1a-bd29-438f-a940-77d89a93ec50',
  currency: 'BRL',
  salePrice: '29.9',
  priceOrigin: 'MANUAL',
  hasComposition: false,
} as const;

describe('pricing contracts', () => {
  it('accepts the strict commercial summary with decimal strings or null', () => {
    expect(pricingProductSummarySchema.parse(summary)).toEqual(summary);
    expect(pricingProductSummarySchema.parse({ ...summary, salePrice: null }).salePrice).toBeNull();
    expect(() => pricingProductSummarySchema.parse({ ...summary, internalCost: '10' })).toThrow();
  });

  it.each(['1e-8', 'NaN', 'Infinity', '', '-1', '+1', '01.00', '1.0'])(
    'rejects the invalid summary decimal %s',
    (salePrice) => {
      expect(pricingProductSummarySchema.safeParse({ ...summary, salePrice }).success).toBe(false);
    },
  );

  it.each(['999999999999.99', '0', '1.23'])(
    'accepts the canonical commercial price %s',
    (salePrice) => {
      expect(pricingCommercialPriceStringSchema.parse(salePrice)).toBe(salePrice);
    },
  );

  it.each(['1000000000000', '1.234', '1,23'])(
    'rejects the non-representable or non-canonical commercial price %s',
    (salePrice) => {
      expect(pricingCommercialPriceStringSchema.safeParse(salePrice).success).toBe(false);
    },
  );

  it('validates structured errors without accepting internal properties', () => {
    expect(
      pricingErrorResponseSchema.parse({
        statusCode: 409,
        code: 'PRICING_REVISION_CONFLICT',
        message: 'A configuração foi alterada.',
        field: 'expectedRevision',
        details: { expectedRevision: 1, currentRevision: 2 },
      }),
    ).toBeDefined();

    expect(
      pricingErrorResponseSchema.safeParse({
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Falha.',
        stack: 'secret',
      }).success,
    ).toBe(false);

    expect(
      pricingErrorResponseSchema.safeParse({
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Falha.',
        details: { sql: 'select secret' },
      }).success,
    ).toBe(false);
  });

  it('distinguishes omission, null and empty string for manual price', () => {
    expect(manualProductPriceInputSchema.safeParse({}).success).toBe(false);
    expect(manualProductPriceInputSchema.parse({ salePrice: null }).salePrice).toBeNull();
    expect(manualProductPriceInputSchema.safeParse({ salePrice: '' }).success).toBe(false);
  });
});
