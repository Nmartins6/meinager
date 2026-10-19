import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { pricingQueryKeys } from './pricing-query-keys';
import {
  useCreatePricingProfileMutation,
  useDeactivatePricingProfileMutation,
  useUpdatePricingProfileMutation,
} from './use-pricing-profile-mutations';

const profileId = '11111111-1111-4111-8111-111111111111';
const productId = '55555555-5555-4555-8555-555555555555';
const versionId = '66666666-6666-4666-8666-666666666666';

const profile = {
  id: profileId,
  isActive: true,
  createdAt: '2026-10-18T12:00:00.000Z',
  updatedAt: '2026-10-18T12:00:00.000Z',
  currentRevision: {
    id: '22222222-2222-4222-8222-222222222222',
    revision: 2,
    name: 'Varejo',
    effectiveFrom: '2026-10-18T12:00:00.000Z',
    createdAt: '2026-10-18T12:00:00.000Z',
    deductions: [],
  },
};

type MutationCase = 'create' | 'update' | 'deactivate';

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function seedUnrelatedCaches(queryClient: QueryClient) {
  const entries = [
    [pricingQueryKeys.configuration(), { configuration: true }],
    [pricingQueryKeys.products.summary(productId), { summary: true }],
    [pricingQueryKeys.products.composition(productId), { composition: true }],
    [pricingQueryKeys.products.versions.list(productId, { page: 1 }), { versions: true }],
    [pricingQueryKeys.products.versions.detail(productId, versionId), { version: true }],
    [['products', { page: 1 }] as const, { legacyProducts: true }],
    [['clients'] as const, { clients: true }],
    [pricingQueryKeys.profiles.detail('77777777-7777-4777-8777-777777777777'), { other: true }],
  ] as const;

  for (const [key, data] of entries) queryClient.setQueryData(key, data);
  return entries;
}

async function exerciseMutation(mutationCase: MutationCase) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(profile), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  );
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const profileListKey = pricingQueryKeys.profiles.list({ page: 1, isActive: true });
  queryClient.setQueryData(profileListKey, { data: ['old-list'] });
  queryClient.setQueryData(pricingQueryKeys.profiles.detail(profileId), { old: true });
  const unrelated = seedUnrelatedCaches(queryClient);
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = makeWrapper(queryClient);

  if (mutationCase === 'create') {
    const { result } = renderHook(() => useCreatePricingProfileMutation(), { wrapper });
    result.current.mutate({ name: 'Varejo', deductions: [] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  } else if (mutationCase === 'update') {
    const { result } = renderHook(() => useUpdatePricingProfileMutation(profileId), { wrapper });
    result.current.mutate({ expectedRevision: 1, name: 'Varejo' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  } else {
    const { result } = renderHook(() => useDeactivatePricingProfileMutation(profileId), {
      wrapper,
    });
    result.current.mutate({ expectedRevision: 2 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  }

  expect(queryClient.getQueryData(pricingQueryKeys.profiles.detail(profileId))).toEqual(profile);
  expect(invalidateSpy).toHaveBeenCalledTimes(1);
  expect(invalidateSpy).toHaveBeenCalledWith({
    queryKey: pricingQueryKeys.profiles.lists(),
  });
  expect(queryClient.getQueryState(profileListKey)?.isInvalidated).toBe(true);

  for (const [key, data] of unrelated) {
    expect(queryClient.getQueryData(key)).toEqual(data);
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('pricing profile mutation cache policy', () => {
  it('updates the detail and invalidates only profile lists after creation', async () => {
    await exerciseMutation('create');
  });

  it('updates the detail and invalidates only profile lists after update', async () => {
    await exerciseMutation('update');
  });

  it('updates the detail and invalidates only profile lists after deactivation', async () => {
    await exerciseMutation('deactivate');
  });
});
