import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import { pricingQueryKeys } from './pricing-query-keys';
import { usePricingAdoptionMutation } from './use-pricing-adoption-mutation';

const productId = '11111111-1111-4111-8111-111111111111';
const versionId = '22222222-2222-4222-8222-222222222222';
const otherProductId = '99999999-9999-4999-8999-999999999999';

afterEach(() => vi.unstubAllGlobals());

function adoptionResponse(id = productId) {
  return {
    product: { id, currency: 'BRL', salePrice: '88.5', adoptedPricingVersionId: versionId },
    adoption: {
      id: '33333333-3333-4333-8333-333333333333',
      productId: id,
      versionId,
      previousVersionId: null,
      previousPrice: null,
      newPrice: '88.5',
      classification: 'BELOW_MINIMUM',
      belowMinimumConfirmed: true,
      justification: 'Motivo reservado',
      createdByUserId: '44444444-4444-4444-8444-444444444444',
      createdAt: '2026-10-27T12:00:00.000Z',
    },
  };
}

it('invalidates commercial and dynamic adoption reads without modifying historical snapshots', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(adoptionResponse()))),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const keys = {
    summary: pricingQueryKeys.products.summary(productId),
    products: ['products', 'detail', productId],
    otherProduct: ['products', 'detail', otherProductId],
    productsList: ['products', 'list', { page: 1 }],
    list: pricingQueryKeys.products.versions.list(productId, { page: 1 }),
    detail: pricingQueryKeys.products.versions.detail(productId, versionId),
    otherVersion: pricingQueryKeys.products.versions.detail(otherProductId, versionId),
    composition: pricingQueryKeys.products.composition(productId),
    configuration: pricingQueryKeys.configuration(),
    profiles: pricingQueryKeys.profiles.list(),
  };
  for (const key of Object.values(keys)) client.setQueryData(key, { frozen: true });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => usePricingAdoptionMutation(productId), { wrapper });
  await act(async () => {
    await result.current.mutateAsync({
      versionId,
      belowMinimumConfirmed: true,
      justification: 'Motivo reservado',
    });
  });
  expect(result.current.isPending).toBe(false);
  expect(client.getMutationCache().getAll()).toEqual([]);
  for (const key of [keys.summary, keys.products, keys.productsList, keys.list, keys.detail]) {
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    expect(client.getQueryData(key)).toEqual({ frozen: true });
  }
  for (const key of [
    keys.otherProduct,
    keys.otherVersion,
    keys.composition,
    keys.configuration,
    keys.profiles,
  ]) {
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    expect(client.getQueryData(key)).toEqual({ frozen: true });
  }
  expect(client.getQueryData(['pricing', 'products', productId, 'adoption'])).toBeUndefined();
});

it('revalidates the original product after an invalid 2xx response, even after unmount', async () => {
  let resolveRequest!: (response: Response) => void;
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        }),
    ),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const originalSummary = pricingQueryKeys.products.summary(productId);
  const otherSummary = pricingQueryKeys.products.summary(otherProductId);
  client.setQueryData(originalSummary, { old: true });
  client.setQueryData(otherSummary, { other: true });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => usePricingAdoptionMutation(productId), { wrapper });
  let operation!: Promise<unknown>;
  act(() => {
    operation = result.current.mutateAsync({ versionId });
  });
  unmount();
  const nextProduct = renderHook(() => usePricingAdoptionMutation(otherProductId), { wrapper });
  resolveRequest(new Response(JSON.stringify({ ...adoptionResponse(), sql: 'SELECT secret' })));
  await expect(operation).rejects.toThrow('Não foi possível validar a resposta da adoção.');
  expect(client.getQueryState(originalSummary)?.isInvalidated).toBe(true);
  expect(client.getQueryState(otherSummary)?.isInvalidated).toBe(false);
  expect(nextProduct.result.current.isPending).toBe(false);
  expect(nextProduct.result.current.isError).toBe(false);
  expect(client.getMutationCache().getAll()).toEqual([]);
});

it('revalidates the original product after an unknown network outcome', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('socket closed');
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const originalSummary = pricingQueryKeys.products.summary(productId);
  client.setQueryData(originalSummary, { old: true });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => usePricingAdoptionMutation(productId), { wrapper });
  await act(async () => {
    await expect(result.current.mutateAsync({ versionId })).rejects.toThrow('socket closed');
  });
  expect(client.getQueryState(originalSummary)?.isInvalidated).toBe(true);
  expect(client.getMutationCache().getAll()).toEqual([]);
});
