import { apiRequest } from '@/lib/api';

import {
  pricingConfigurationSchema,
  type PricingConfiguration,
  type UpdatePricingConfigurationInput,
  updatePricingConfigurationInputSchema,
} from './pricing-configuration-contracts';

export async function getPricingConfiguration(): Promise<PricingConfiguration> {
  const response = await apiRequest('/pricing/configuration');
  return pricingConfigurationSchema.parse(await response.json());
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

  return pricingConfigurationSchema.parse(await response.json());
}
