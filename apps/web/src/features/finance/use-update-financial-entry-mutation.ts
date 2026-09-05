import { useMutation, useQueryClient } from '@tanstack/react-query';

import { type UpdateFinancialEntryInput, updateFinancialEntry } from './financial-entries-api';

interface UpdateFinancialEntryVariables {
  entryId: string;
  input: UpdateFinancialEntryInput;
}

export function useUpdateFinancialEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ entryId, input }: UpdateFinancialEntryVariables) =>
      updateFinancialEntry(entryId, input),
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
