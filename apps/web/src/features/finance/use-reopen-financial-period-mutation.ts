import { useMutation, useQueryClient } from '@tanstack/react-query';

import { reopenFinancialPeriod } from './finance-api';

export function useReopenFinancialPeriodMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reopenFinancialPeriod,
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
