import { useMutation, useQueryClient } from '@tanstack/react-query';

import { transitionOrder, type OrderLifecycleAction } from './orders-api';

interface OrderLifecycleInput {
  orderId: string;
  action: OrderLifecycleAction;
}

export function useOrderLifecycleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, action }: OrderLifecycleInput) => transitionOrder(orderId, action),
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
