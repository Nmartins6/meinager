import { useMutation, useQueryClient } from '@tanstack/react-query';

import { duplicateFinancialEntryToNextMonth } from './financial-entries-api';

export function useDuplicateFinancialEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: duplicateFinancialEntryToNextMonth,
    onSuccess: async (entry) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['finance', 'entries'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['finance', 'periods', entry.period.id, 'summary'],
        }),
      ]);
    },
  });
}
