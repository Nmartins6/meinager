import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateProduct, type UpdateProductInput } from './products-api';

interface UpdateProductMutationInput {
  productId: string;
  input: UpdateProductInput;
}

export function useUpdateProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, input }: UpdateProductMutationInput) =>
      updateProduct(productId, input),
    onSuccess: async (product) => {
      await queryClient.invalidateQueries({
        queryKey: ['products'],
      });

      queryClient.setQueryData(['products', 'detail', product.id], product);
    },
  });
}
