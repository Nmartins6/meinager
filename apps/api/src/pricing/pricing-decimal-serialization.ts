import type { Prisma } from '../generated/prisma/client.js';

export function serializePricingDecimal(value: Prisma.Decimal): string {
  return value.toFixed();
}
