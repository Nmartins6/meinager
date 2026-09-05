import { useMutation, useQueryClient } from '@tanstack/react-query';

import { type UpdateFinancialAccountInput, updateFinancialAccount } from './financial-accounts-api';

interface UpdateFinancialAccountVariables {
  accountId: string;
  input: UpdateFinancialAccountInput;
}

export function useUpdateFinancialAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ accountId, input }: UpdateFinancialAccountVariables) =>
      updateFinancialAccount(accountId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['finance', 'accounts'],
      });
    },
  });
}
