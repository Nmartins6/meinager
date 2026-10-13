import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ManualProductPriceInput } from './pricing-contracts';
import { setManualProductPrice } from './pricing-api';
import { pricingQueryKeys } from './pricing-query-keys';

interface SetManualProductPriceMutationInput extends ManualProductPriceInput {
  productId: string;
}

export function useSetManualProductPriceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, salePrice }: SetManualProductPriceMutationInput) =>
      setManualProductPrice(productId, { salePrice }),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: pricingQueryKeys.products.summary(variables.productId),
        }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({
          queryKey: pricingQueryKeys.products.versions.all(variables.productId),
        }),
      ]);
    },
  });
}
