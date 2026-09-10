import { NotFoundException } from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client.js';

export async function lockProduct(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  productId: string,
): Promise<void> {
  const products = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "products"
    WHERE "organization_id" = ${organizationId}::uuid
      AND "id" = ${productId}::uuid
    FOR UPDATE
  `;

  if (products.length === 0) {
    throw new NotFoundException('Produto não encontrado.');
  }
}
