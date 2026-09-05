import { useMutation, useQueryClient } from '@tanstack/react-query';

import { closeFinancialPeriod } from './finance-api';

export function useCloseFinancialPeriodMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: closeFinancialPeriod,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['finance', 'periods'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['finance', 'entries'],
        }),
      ]);
    },
  });
}
