import { useQuery } from '@tanstack/react-query';

import { getStockMovements, type ListStockMovementsInput } from './inventory-api';

export function useStockMovementsQuery(productId: string, input: ListStockMovementsInput = {}) {
  return useQuery({
    queryKey: ['inventory', 'products', productId, 'movements', input],
    queryFn: () => getStockMovements(productId, input),
    enabled: Boolean(productId),
  });
}
