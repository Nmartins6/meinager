import { ApiError, apiRequest } from '@/lib/api';

import {
  pricingCompositionSchema,
  putPricingCompositionInputSchema,
  type PricingComposition,
  type PutPricingCompositionInput,
} from './pricing-composition-contracts';

export async function getPricingComposition(productId: string): Promise<PricingComposition | null> {
  try {
    const response = await apiRequest(
      `/pricing/products/${encodeURIComponent(productId)}/composition`,
    );
    return pricingCompositionSchema.parse(await response.json());
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 404 &&
      error.code === 'PRICING_COMPOSITION_NOT_FOUND'
    ) {
      return null;
    }
    throw error;
  }
}

export async function putPricingComposition(
  productId: string,
  input: PutPricingCompositionInput,
): Promise<PricingComposition> {
  const parsed = putPricingCompositionInputSchema.parse(input);
  const response = await apiRequest(
    `/pricing/products/${encodeURIComponent(productId)}/composition`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    },
  );
  return pricingCompositionSchema.parse(await response.json());
}
