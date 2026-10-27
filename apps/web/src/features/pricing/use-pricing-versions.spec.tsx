import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { pricingQueryKeys } from './pricing-query-keys';
import { useCreatePricingVersionMutation } from './use-pricing-versions';
import { pricingVersionFixture } from './pricing-versions-test-fixtures';

const productId = '11111111-1111-4111-8111-111111111111';
const created = pricingVersionFixture();

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('invalidates only this product’s version lists and never caches POST as detail', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(created), { status: 201 })),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const currentList = pricingQueryKeys.products.versions.list(productId, { page: 1, pageSize: 20 });
  const otherList = pricingQueryKeys.products.versions.list(
    '99999999-9999-4999-8999-999999999999',
    { page: 1 },
  );
  const detail = pricingQueryKeys.products.versions.detail(productId, created.id);
  const preserved = [
    [detail, { historical: true }],
    [otherList, { other: true }],
    [pricingQueryKeys.configuration(), { configuration: true }],
    [pricingQueryKeys.profiles.list({ page: 1 }), { profile: true }],
    [pricingQueryKeys.products.summary(productId), { summary: true }],
    [pricingQueryKeys.products.composition(productId), { composition: true }],
    [['products', 'list'] as const, { legacy: true }],
    [['clients'] as const, { clients: true }],
  ] as const;
  client.setQueryData(currentList, { old: true });
  preserved.forEach(([key, value]) => client.setQueryData(key, value));
  const invalidation = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useCreatePricingVersionMutation(productId), { wrapper });
  result.current.mutate({ expectedCompositionRevision: 3 });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(invalidation).toHaveBeenCalledOnce();
  expect(invalidation).toHaveBeenCalledWith({
    queryKey: [...pricingQueryKeys.products.versions.all(productId), 'list'],
  });
  expect(client.getQueryState(currentList)?.isInvalidated).toBe(true);
  for (const [key, value] of preserved) {
    expect(client.getQueryData(key)).toEqual(value);
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);
  }
  expect(
    client.getQueryData(pricingQueryKeys.products.versions.detail(productId, 'new-version')),
  ).toBeUndefined();
});
