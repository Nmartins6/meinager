import { useQuery } from '@tanstack/react-query';

import { getProduct } from './products-api';

export function useProductQuery(productId: string | undefined) {
  return useQuery({
    queryKey: ['products', 'detail', productId],
    enabled: Boolean(productId),
    queryFn: () => {
      if (!productId) {
        throw new Error('Informe o identificador do produto.');
      }

      return getProduct(productId);
    },
  });
}
