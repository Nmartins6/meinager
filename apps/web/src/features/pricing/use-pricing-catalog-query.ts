import { useQuery } from '@tanstack/react-query';

import { getProducts, type Product } from '@/features/products/products-api';

const pricingCatalogQueryKey = ['products', 'list', 'pricing-catalog-active'] as const;

export function usePricingCatalogQuery(enabled: boolean) {
  return useQuery({
    queryKey: pricingCatalogQueryKey,
    queryFn: async () => {
      const products = new Map<string, Product>();
      let page = 1;
      let totalPages = 1;
      do {
        const response = await getProducts({ page, pageSize: 100, isActive: true });
        for (const product of response.data) {
          if (!products.has(product.id)) products.set(product.id, product);
        }
        totalPages = response.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);
      return [...products.values()];
    },
    enabled,
    retry: false,
  });
}
