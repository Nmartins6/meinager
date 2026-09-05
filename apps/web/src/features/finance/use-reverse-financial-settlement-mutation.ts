import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  reverseFinancialSettlement,
  type ReverseFinancialSettlementInput,
} from './financial-settlements-api';

interface ReverseFinancialSettlementVariables {
  settlementId: string;
  input: ReverseFinancialSettlementInput;
}

export function useReverseFinancialSettlementMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ settlementId, input }: ReverseFinancialSettlementVariables) =>
      reverseFinancialSettlement(settlementId, input),
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
