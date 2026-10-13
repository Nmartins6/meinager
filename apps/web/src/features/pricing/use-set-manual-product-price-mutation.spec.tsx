import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { pricingQueryKeys } from './pricing-query-keys';
import { useSetManualProductPriceMutation } from './use-set-manual-product-price-mutation';

const productId = 'f25c7c1a-bd29-438f-a940-77d89a93ec50';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useSetManualProductPriceMutation', () => {
  it('invalidates summary, legacy products and all cached version queries by prefix', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 200 })),
    );
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    const versionListKey = pricingQueryKeys.products.versions.list(productId, { page: 1 });
    const versionDetailKey = pricingQueryKeys.products.versions.detail(productId, 'version-1');
    queryClient.setQueryData(versionListKey, { data: [] });
    queryClient.setQueryData(versionDetailKey, { id: 'version-1' });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSetManualProductPriceMutation(), { wrapper });

    result.current.mutate({ productId, salePrice: '29.9' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: pricingQueryKeys.products.summary(productId),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['products'] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: pricingQueryKeys.products.versions.all(productId),
    });
    expect(queryClient.getQueryState(versionListKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(versionDetailKey)?.isInvalidated).toBe(true);
  });
});
