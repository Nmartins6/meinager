import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getOrders, type ListOrdersInput } from './orders-api';

export function useOrdersQuery(input: ListOrdersInput = {}) {
  return useQuery({
    queryKey: ['orders', 'list', input],
    queryFn: () => getOrders(input),
    placeholderData: keepPreviousData,
  });
}
