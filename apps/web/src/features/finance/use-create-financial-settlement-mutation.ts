import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  createFinancialSettlement,
  type CreateFinancialSettlementInput,
} from './financial-settlements-api';

interface CreateFinancialSettlementVariables {
  entryId: string;
  input: CreateFinancialSettlementInput;
}

export function useCreateFinancialSettlementMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ entryId, input }: CreateFinancialSettlementVariables) =>
      createFinancialSettlement(entryId, input),
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['finance', 'settlements', response.entry.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['finance', 'entries'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['finance', 'periods'],
        }),
      ]);
    },
  });
}
