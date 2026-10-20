import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { pricingQueryKeys } from './pricing-query-keys';
import { usePutPricingCompositionMutation } from './use-put-pricing-composition-mutation';

const productId = '11111111-1111-4111-8111-111111111111';
const composition = {
  id: '22222222-2222-4222-8222-222222222222',
  productId,
  revision: 1,
  profileId: null,
  desiredMargin: null,
  laborEnabled: false,
  timeMinutes: null,
  freightMode: null,
  freightUnitCost: null,
  freightTotalCost: null,
  freightQuantity: null,
  freightConsumedQuantity: null,
  parameterOrigins: {},
  isActive: true,
  createdAt: '2026-10-19T12:00:00.000Z',
  updatedAt: '2026-10-19T12:00:00.000Z',
  components: [],
};
const input = {
  expectedRevision: null,
  profileId: null,
  desiredMargin: null,
  laborEnabled: false,
  timeMinutes: null,
  freightMode: null,
  freightUnitCost: null,
  freightTotalCost: null,
  freightQuantity: null,
  freightConsumedQuantity: null,
  parameterOrigins: {},
  components: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('updates only the exact composition and invalidates only the exact summary', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Promise.resolve(
        new Response(JSON.stringify(composition), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const exactComposition = pricingQueryKeys.products.composition(productId);
  const summary = pricingQueryKeys.products.summary(productId);
  const preserved = [
    [pricingQueryKeys.configuration(), { configuration: true }],
    [pricingQueryKeys.profiles.list({ page: 1 }), { profiles: true }],
    [pricingQueryKeys.products.versions.list(productId, { page: 1 }), { versions: true }],
    [['products', 'list', { page: 1 }] as const, { products: true }],
    [['clients'] as const, { clients: true }],
  ] as const;
  client.setQueryData(exactComposition, { old: true });
  client.setQueryData(summary, { hasComposition: false });
  preserved.forEach(([key, data]) => client.setQueryData(key, data));
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => usePutPricingCompositionMutation(productId), {
    wrapper,
  });

  result.current.mutate(input);
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(client.getQueryData(exactComposition)).toEqual(composition);
  expect(invalidate).toHaveBeenCalledOnce();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: summary, exact: true });
  expect(client.getQueryState(summary)?.isInvalidated).toBe(true);
  for (const [key, data] of preserved) {
    expect(client.getQueryData(key)).toEqual(data);
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);
  }
});
