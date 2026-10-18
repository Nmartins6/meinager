import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { pricingQueryKeys } from './pricing-query-keys';
import { useUpdatePricingConfigurationMutation } from './use-update-pricing-configuration-mutation';

const configuration = {
  id: '7d9805c3-00ba-486e-a59b-188c72aa3551',
  isActive: true,
  currentRevision: {
    id: 'cf2c1950-fb93-4490-864a-99e02990f4f1',
    revision: 2,
    effectiveFrom: '2026-10-13T12:00:00.000Z',
    currency: 'BRL',
    fixedCostMode: null,
    fixedCostRate: null,
    monthlyFixedCost: null,
    averageMonthlyRevenue: null,
    monthlyLaborCost: null,
    productiveHours: null,
    defaultDesiredMargin: null,
    parameterOrigins: {},
    createdAt: '2026-10-13T12:00:00.000Z',
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useUpdatePricingConfigurationMutation', () => {
  it('updates only the configuration cache without invalidating historical versions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(configuration), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    const versionKey = pricingQueryKeys.products.versions.detail(
      'f25c7c1a-bd29-438f-a940-77d89a93ec50',
      '7e8359fd-79f9-43a4-8f56-a74c3f92f864',
    );
    queryClient.setQueryData(versionKey, { immutable: true });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdatePricingConfigurationMutation(), { wrapper });

    result.current.mutate({ expectedRevision: 1, defaultDesiredMargin: '0.25' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(pricingQueryKeys.configuration())).toEqual(configuration);
    expect(queryClient.getQueryData(versionKey)).toEqual({ immutable: true });
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
