import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createProduct } from './products-api';

export function useCreateProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProduct,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['products'],
      });
    },
  });
}
