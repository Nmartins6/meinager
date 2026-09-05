import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createFinancialAccount } from './financial-accounts-api';

export function useCreateFinancialAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createFinancialAccount,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['finance', 'accounts'],
      });
    },
  });
}
