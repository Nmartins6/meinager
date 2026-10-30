import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/lib/api';

import { adoptPricingVersion } from './pricing-adoption-api';
import type { PricingAdoptionInput } from './pricing-adoption-contracts';
import { pricingQueryKeys } from './pricing-query-keys';

type MutationState = 'idle' | 'pending' | 'success' | 'error';

// Justification must not become mutation.variables in TanStack Query's MutationCache.
// The request survives unmount and refreshes the original product on settlement.
export function usePricingAdoptionMutation(productId: string) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<MutationState>('idle');
  const [error, setError] = useState<Error | null>(null);
  const active = useRef(true);
  const pending = useRef(false);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const refreshCommercialState = useCallback(async () => {
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: pricingQueryKeys.products.summary(productId) }),
      queryClient.invalidateQueries({ queryKey: ['products', 'list'] }),
      queryClient.invalidateQueries({ queryKey: ['products', 'detail', productId] }),
      queryClient.invalidateQueries({
        queryKey: pricingQueryKeys.products.versions.all(productId),
      }),
    ]);
  }, [productId, queryClient]);

  const reset = useCallback(() => {
    if (!active.current) return;
    setState('idle');
    setError(null);
  }, []);

  const mutateAsync = useCallback(
    async (input: PricingAdoptionInput) => {
      if (pending.current) throw new Error('Já existe uma adoção em andamento.');
      pending.current = true;
      if (active.current) {
        setState('pending');
        setError(null);
      }
      try {
        const response = await adoptPricingVersion(productId, input);
        await refreshCommercialState();
        if (active.current) setState('success');
        return { productId: response.product.id, versionId: response.adoption.versionId };
      } catch (caught) {
        // Network failures and invalid 2xx responses leave the transaction outcome unknown.
        if (!(caught instanceof ApiError) || caught.status >= 500) {
          await refreshCommercialState();
        }
        const failure = caught instanceof Error ? caught : new Error('Falha de adoção.');
        if (active.current) {
          setState('error');
          setError(failure);
        }
        throw failure;
      } finally {
        pending.current = false;
      }
    },
    [productId, refreshCommercialState],
  );

  return {
    mutateAsync,
    reset,
    verify: refreshCommercialState,
    isPending: state === 'pending',
    isError: state === 'error',
    error,
  };
}
