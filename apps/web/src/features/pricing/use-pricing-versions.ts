import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createPricingVersion,
  getPricingVersion,
  listPricingVersions,
} from './pricing-versions-api';
import { pricingQueryKeys } from './pricing-query-keys';

export function usePricingVersionsQuery(
  productId: string,
  page: number,
  pageSize: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: pricingQueryKeys.products.versions.list(productId, { page, pageSize }),
    queryFn: () => listPricingVersions(productId, page, pageSize),
    enabled,
    retry: false,
  });
}

export function usePricingVersionDetailQuery(productId: string, versionId: string | null) {
  return useQuery({
    queryKey: pricingQueryKeys.products.versions.detail(productId, versionId ?? ''),
    queryFn: () => getPricingVersion(productId, versionId!),
    enabled: versionId !== null,
    retry: false,
  });
}

export function useCreatePricingVersionMutation(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createPricingVersion>[1]) =>
      createPricingVersion(productId, input),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: [...pricingQueryKeys.products.versions.all(productId), 'list'],
      }),
  });
}
