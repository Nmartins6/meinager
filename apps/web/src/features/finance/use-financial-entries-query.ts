import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getFinancialEntries, type ListFinancialEntriesInput } from './financial-entries-api';

export function useFinancialEntriesQuery(input: ListFinancialEntriesInput = {}, enabled = true) {
  return useQuery({
    queryKey: ['finance', 'entries', input],
    queryFn: () => getFinancialEntries(input),
    placeholderData: keepPreviousData,
    enabled,
  });
}
