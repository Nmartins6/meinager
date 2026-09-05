import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  type UpdateFinancialCategoryInput,
  updateFinancialCategory,
} from './financial-categories-api';

interface UpdateFinancialCategoryVariables {
  categoryId: string;
  input: UpdateFinancialCategoryInput;
}

export function useUpdateFinancialCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ categoryId, input }: UpdateFinancialCategoryVariables) =>
      updateFinancialCategory(categoryId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['finance', 'categories'],
      });
    },
  });
}
