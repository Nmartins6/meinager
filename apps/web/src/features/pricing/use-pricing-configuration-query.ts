import { useQuery } from '@tanstack/react-query';

import { getPricingConfiguration } from './pricing-configuration-api';
import { pricingQueryKeys } from './pricing-query-keys';

export function usePricingConfigurationQuery(enabled: boolean) {
  return useQuery({
    queryKey: pricingQueryKeys.configuration(),
    queryFn: getPricingConfiguration,
    enabled,
    retry: false,
  });
}
