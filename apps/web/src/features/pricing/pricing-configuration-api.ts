import { apiRequest } from '@/lib/api';

import {
  pricingConfigurationSchema,
  type PricingConfiguration,
  type UpdatePricingConfigurationInput,
  updatePricingConfigurationInputSchema,
} from './pricing-configuration-contracts';
import { parsePricingResponse } from './parse-pricing-response';

export async function getPricingConfiguration(): Promise<PricingConfiguration> {
  const response = await apiRequest('/pricing/configuration');
  return parsePricingResponse(response, pricingConfigurationSchema);
}

export async function updatePricingConfiguration(
  input: UpdatePricingConfigurationInput,
): Promise<PricingConfiguration> {
  const parsedInput = updatePricingConfigurationInputSchema.parse(input);
  const response = await apiRequest('/pricing/configuration', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsedInput),
  });

  return parsePricingResponse(response, pricingConfigurationSchema);
}
