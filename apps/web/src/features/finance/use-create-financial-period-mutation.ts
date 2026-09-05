import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFinancialPeriod } from './finance-api';

export function useCreateFinancialPeriodMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createFinancialPeriod,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['finance', 'periods'],
      });
    },
  });
}
