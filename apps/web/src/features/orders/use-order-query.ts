import { useQuery } from '@tanstack/react-query';

import { getOrder } from './orders-api';

export function useOrderQuery(orderId: string | undefined) {
  return useQuery({
    queryKey: ['orders', 'detail', orderId],
    queryFn: () => {
      if (!orderId) {
        throw new Error('Identificador do pedido não informado.');
      }

      return getOrder(orderId);
    },
    enabled: Boolean(orderId),
  });
}
