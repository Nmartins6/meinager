import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getProducts, type ListProductsInput } from './products-api';

export function useProductsQuery(input: ListProductsInput = {}) {
  return useQuery({
    queryKey: ['products', 'list', input],
    queryFn: () => getProducts(input),
    placeholderData: keepPreviousData,
  });
}
