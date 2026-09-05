import { useQuery } from '@tanstack/react-query';

import { getFinancialEntry } from './financial-entries-api';

export function useFinancialEntryQuery(entryId?: string) {
  return useQuery({
    queryKey: ['finance', 'entries', entryId],
    queryFn: () => {
      if (!entryId) {
        throw new Error('Selecione um lançamento financeiro.');
      }

      return getFinancialEntry(entryId);
    },
    enabled: Boolean(entryId),
  });
}
