import { useMutation, useQueryClient } from '@tanstack/react-query';

import { transitionQuote, type QuoteLifecycleAction } from './quotes-api';

interface QuoteLifecycleInput {
  quoteId: string;
  action: QuoteLifecycleAction;
}

export function useQuoteLifecycleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quoteId, action }: QuoteLifecycleInput) => transitionQuote(quoteId, action),
    onSuccess: async (quote) => {
      queryClient.setQueryData(['quotes', 'detail', quote.id], quote);

      await queryClient.invalidateQueries({
        queryKey: ['quotes', 'list'],
      });
    },
  });
}
