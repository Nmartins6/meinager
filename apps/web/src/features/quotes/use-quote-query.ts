import { useQuery } from '@tanstack/react-query';

import { getQuote } from './quotes-api';

export function useQuoteQuery(quoteId: string | undefined) {
  return useQuery({
    queryKey: ['quotes', 'detail', quoteId],
    queryFn: () => {
      if (!quoteId) {
        throw new Error('Identificador do orçamento não informado.');
      }

      return getQuote(quoteId);
    },
    enabled: Boolean(quoteId),
  });
}
