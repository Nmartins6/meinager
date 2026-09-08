import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createStockMovement, type CreateStockMovementInput } from './inventory-api';

interface CreateStockMovementVariables {
  productId: string;
  input: CreateStockMovementInput;
}

export function useCreateStockMovementMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, input }: CreateStockMovementVariables) =>
      createStockMovement(productId, input),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ['inventory', 'products', variables.productId],
      });
    },
  });
}
