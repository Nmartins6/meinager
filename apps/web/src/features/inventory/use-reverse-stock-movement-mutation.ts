import { useMutation, useQueryClient } from '@tanstack/react-query';

import { reverseStockMovement, type ReverseStockMovementInput } from './inventory-api';

interface ReverseStockMovementVariables {
  productId: string;
  movementId: string;
  input: ReverseStockMovementInput;
}

export function useReverseStockMovementMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, movementId, input }: ReverseStockMovementVariables) =>
      reverseStockMovement(productId, movementId, input),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ['inventory', 'products', variables.productId],
      });
    },
  });
}
