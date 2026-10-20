import { useMutation, useQueryClient } from '@tanstack/react-query';

import { putPricingComposition } from './pricing-composition-api';
import type { PutPricingCompositionInput } from './pricing-composition-contracts';
import { pricingQueryKeys } from './pricing-query-keys';

export function usePutPricingCompositionMutation(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PutPricingCompositionInput) => putPricingComposition(productId, input),
    retry: false,
    onSuccess: (composition) => {
      queryClient.setQueryData(pricingQueryKeys.products.composition(productId), composition);
      void queryClient.invalidateQueries({
        queryKey: pricingQueryKeys.products.summary(productId),
        exact: true,
      });
    },
  });
}
