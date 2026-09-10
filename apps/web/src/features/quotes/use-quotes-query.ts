import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getQuotes, type ListQuotesInput } from './quotes-api';

export function useQuotesQuery(input: ListQuotesInput = {}) {
  return useQuery({
    queryKey: ['quotes', 'list', input],
    queryFn: () => getQuotes(input),
    placeholderData: keepPreviousData,
  });
}
