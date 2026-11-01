import { useQuery } from '@tanstack/react-query';
import { getClients, type Client } from '@/features/clients/clients-api';
import { getProducts, type Product } from '@/features/products/products-api';

export function useQuoteClientsQuery(enabled: boolean) {
  return useQuery({
    queryKey: ['clients', 'quote-options'],
    enabled,
    queryFn: async () => {
      const results = new Map<string, Client>();
      let page = 1;
      let pages = 1;
      do {
        const response = await getClients({ isActive: true, page, pageSize: 100 });
        for (const client of response.data) results.set(client.id, client);
        pages = response.pagination.totalPages;
        page += 1;
      } while (page <= pages);
      return [...results.values()];
    },
  });
}

export function useQuoteProductsQuery(enabled: boolean) {
  return useQuery({
    queryKey: ['products', 'quote-options'],
    enabled,
    queryFn: async () => {
      const results = new Map<string, Product>();
      let page = 1;
      let pages = 1;
      do {
        const response = await getProducts({ isActive: true, page, pageSize: 100 });
        for (const product of response.data) {
          if (product.adoptedPricingVersionId === undefined) {
            throw new Error('A origem atual do preço do produto não está disponível.');
          }
          results.set(product.id, product);
        }
        pages = response.pagination.totalPages;
        page += 1;
      } while (page <= pages);
      return [...results.values()];
    },
  });
}
