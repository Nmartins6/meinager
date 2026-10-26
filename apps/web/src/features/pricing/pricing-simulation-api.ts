import { apiRequest } from '@/lib/api';

import {
  pricingSimulationInputSchema,
  pricingSimulationResponseSchema,
  type PricingSimulationInput,
  type PricingSimulationResponse,
} from './pricing-simulation-contracts';

export async function simulatePricing(
  productId: string,
  input: PricingSimulationInput,
): Promise<PricingSimulationResponse> {
  const parsed = pricingSimulationInputSchema.parse(input);
  const response = await apiRequest(
    `/pricing/products/${encodeURIComponent(productId)}/simulations`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    },
  );
  try {
    return pricingSimulationResponseSchema.parse(await response.json());
  } catch {
    throw new Error('Não foi possível validar a resposta da simulação. Tente novamente.');
  }
}
