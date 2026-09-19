import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateQuote, type UpdateQuoteInput } from './quotes-api';

interface UpdateQuoteMutationInput {
  quoteId: string;
  input: UpdateQuoteInput;
}

export function useUpdateQuoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quoteId, input }: UpdateQuoteMutationInput) => updateQuote(quoteId, input),
    onSuccess: async (quote) => {
      queryClient.setQueryData(['quotes', 'detail', quote.id], quote);

      await queryClient.invalidateQueries({
        queryKey: ['quotes', 'list'],
      });
    },
  });
}
