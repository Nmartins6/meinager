import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { UpdatePricingConfigurationInput } from './pricing-configuration-contracts';
import { updatePricingConfiguration } from './pricing-configuration-api';
import { pricingQueryKeys } from './pricing-query-keys';

export function useUpdatePricingConfigurationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdatePricingConfigurationInput) => updatePricingConfiguration(input),
    retry: false,
    onSuccess: (configuration) => {
      queryClient.setQueryData(pricingQueryKeys.configuration(), configuration);
    },
  });
}
