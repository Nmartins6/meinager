import { useQuery } from '@tanstack/react-query';

import { getPricingProductSummary } from './pricing-api';
import { pricingQueryKeys } from './pricing-query-keys';

export function usePricingProductSummaryQuery(productId: string | undefined) {
  return useQuery({
    queryKey: pricingQueryKeys.products.summary(productId ?? ''),
    enabled: Boolean(productId),
    queryFn: () => {
      if (!productId) {
        throw new Error('Informe o identificador do produto.');
      }

      return getPricingProductSummary(productId);
    },
  });
}
