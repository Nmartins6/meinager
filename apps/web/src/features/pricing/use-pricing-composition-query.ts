import { useQuery } from '@tanstack/react-query';

import { getPricingComposition } from './pricing-composition-api';
import { pricingQueryKeys } from './pricing-query-keys';

export function usePricingCompositionQuery(productId: string, enabled: boolean) {
  return useQuery({
    queryKey: pricingQueryKeys.products.composition(productId),
    queryFn: () => getPricingComposition(productId),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
