import { useMutation, useQueryClient } from '@tanstack/react-query';

import { adjustStock, type AdjustStockInput } from './inventory-api';

interface AdjustStockVariables {
  productId: string;
  input: AdjustStockInput;
}

export function useAdjustStockMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, input }: AdjustStockVariables) => adjustStock(productId, input),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ['inventory', 'products', variables.productId],
      });
    },
  });
}
