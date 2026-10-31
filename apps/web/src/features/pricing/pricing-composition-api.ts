import { ApiError, apiRequest } from '@/lib/api';

import {
  pricingCompositionSchema,
  putPricingCompositionInputSchema,
  type PricingComposition,
  type PutPricingCompositionInput,
} from './pricing-composition-contracts';
import { parsePricingResponse } from './parse-pricing-response';

export async function getPricingComposition(productId: string): Promise<PricingComposition | null> {
  try {
    const response = await apiRequest(
      `/pricing/products/${encodeURIComponent(productId)}/composition`,
    );
    return parsePricingResponse(response, pricingCompositionSchema);
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
  return parsePricingResponse(response, pricingCompositionSchema);
}
