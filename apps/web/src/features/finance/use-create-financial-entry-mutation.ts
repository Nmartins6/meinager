import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createFinancialEntry } from './financial-entries-api';

export function useCreateFinancialEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createFinancialEntry,
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
