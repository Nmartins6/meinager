import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createOrderFromQuote, type CreateOrderFromQuoteInput } from './orders-api';

export function useCreateOrderFromQuoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateOrderFromQuoteInput) => createOrderFromQuote(input),
    onSuccess: async (order) => {
      queryClient.setQueryData(['orders', 'detail', order.id], order);

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['orders', 'list'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['quotes'],
        }),
      ]);
    },
  });
}
