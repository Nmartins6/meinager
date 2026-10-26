import { useMutation } from '@tanstack/react-query';

import { simulatePricing } from './pricing-simulation-api';

export function usePricingSimulationMutation(productId: string) {
  return useMutation({
    mutationFn: (input: Parameters<typeof simulatePricing>[1]) => simulatePricing(productId, input),
  });
}
