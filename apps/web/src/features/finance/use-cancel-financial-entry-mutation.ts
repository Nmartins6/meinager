import { useMutation, useQueryClient } from '@tanstack/react-query';

import { cancelFinancialEntry, type CancelFinancialEntryInput } from './financial-entries-api';

interface CancelFinancialEntryVariables {
  entryId: string;
  input: CancelFinancialEntryInput;
}

export function useCancelFinancialEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ entryId, input }: CancelFinancialEntryVariables) =>
      cancelFinancialEntry(entryId, input),
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
