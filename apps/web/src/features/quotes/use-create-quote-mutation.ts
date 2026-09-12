import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createQuote, type CreateQuoteInput } from './quotes-api';

export function useCreateQuoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateQuoteInput) => createQuote(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['quotes', 'list'],
      });
    },
  });
}
