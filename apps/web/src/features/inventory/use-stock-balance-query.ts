import { useQuery } from '@tanstack/react-query';

import { getStockBalance } from './inventory-api';

export function useStockBalanceQuery(productId: string) {
  return useQuery({
    queryKey: ['inventory', 'products', productId, 'balance'],
    queryFn: () => getStockBalance(productId),
    enabled: Boolean(productId),
  });
}
