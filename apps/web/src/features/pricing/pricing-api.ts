import { apiRequest } from '@/lib/api';

import {
  manualProductPriceInputSchema,
  pricingProductSummarySchema,
  type ManualProductPriceInput,
  type PricingProductSummary,
} from './pricing-contracts';
import { parsePricingResponse } from './parse-pricing-response';

export async function getPricingProductSummary(productId: string): Promise<PricingProductSummary> {
  const response = await apiRequest(`/pricing/products/${encodeURIComponent(productId)}/summary`);

  return parsePricingResponse(response, pricingProductSummarySchema);
}

export async function setManualProductPrice(
  productId: string,
  input: ManualProductPriceInput,
): Promise<void> {
  const parsedInput = manualProductPriceInputSchema.parse(input);

  await apiRequest(`/products/${encodeURIComponent(productId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(parsedInput),
  });
}
