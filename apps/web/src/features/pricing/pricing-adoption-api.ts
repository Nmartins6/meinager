import { apiRequest } from '@/lib/api';

import {
  pricingAdoptionInputSchema,
  pricingAdoptionResponseSchema,
  type PricingAdoptionInput,
} from './pricing-adoption-contracts';

export async function adoptPricingVersion(productId: string, input: PricingAdoptionInput) {
  const payload = pricingAdoptionInputSchema.parse(input);
  const response = await apiRequest(
    `/pricing/products/${encodeURIComponent(productId)}/adoptions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  try {
    const result = pricingAdoptionResponseSchema.parse(await response.json());
    if (
      result.product.id !== productId ||
      result.product.adoptedPricingVersionId !== payload.versionId ||
      result.adoption.productId !== productId ||
      result.adoption.versionId !== payload.versionId ||
      result.product.salePrice !== result.adoption.newPrice
    ) {
      throw new Error('Resposta incompatível');
    }
    return result;
  } catch {
    throw new Error('Não foi possível validar a resposta da adoção. Consulte o preço atual.');
  }
}
