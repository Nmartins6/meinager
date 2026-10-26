import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

import { pricingQueryKeys } from './pricing-query-keys';
import { pricingSimulationResponseFixture } from './pricing-simulation-test-fixtures';
import { usePricingSimulationMutation } from './use-pricing-simulation-mutation';

const productId = '11111111-1111-4111-8111-111111111111';

afterEach(() => vi.unstubAllGlobals());

it('keeps simulation transient without query cache writes or invalidations', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(pricingSimulationResponseFixture()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const keys = [
    pricingQueryKeys.configuration(),
    pricingQueryKeys.products.summary(productId),
    pricingQueryKeys.products.composition(productId),
    pricingQueryKeys.products.versions.all(productId),
    ['products'] as const,
  ];
  keys.forEach((key, index) => client.setQueryData(key, { marker: index }));
  const before = keys.map((key) => client.getQueryData(key));
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const setQueryData = vi.spyOn(client, 'setQueryData');
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => usePricingSimulationMutation(productId), { wrapper });

  await act(async () => {
    await result.current.mutateAsync({ source: 'PERSISTED', adoptedPrice: '88.5' });
  });

  expect(invalidate).not.toHaveBeenCalled();
  expect(setQueryData).not.toHaveBeenCalled();
  expect(keys.map((key) => client.getQueryData(key))).toEqual(before);
  expect(client.getQueryCache().findAll({ queryKey: ['pricing', 'simulations'] })).toHaveLength(0);
});
