import { Prisma } from '../generated/prisma/client.js';
import { serializePricingDecimal } from './pricing-decimal-serialization.js';

describe('serializePricingDecimal', () => {
  it('serializes the smallest Decimal(12,8) value without exponent or rounding', () => {
    const result = serializePricingDecimal(new Prisma.Decimal('0.00000001'));

    expect(result).toBe('0.00000001');
    expect(result.toLowerCase()).not.toContain('e');
  });
});
