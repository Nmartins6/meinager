import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createFinancialCategory } from './financial-categories-api';

export function useCreateFinancialCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createFinancialCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['finance', 'categories'],
      });
    },
  });
}
