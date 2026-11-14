import { createContext, useContext, useId, useLayoutEffect } from 'react';
import type { useBlocker } from 'react-router-dom';

export type PricingDraftBlocker = ReturnType<typeof useBlocker>;
const idle: PricingDraftBlocker = {
  state: 'unblocked',
  proceed: undefined,
  reset: undefined,
  location: undefined,
};
export const PricingDraftContext = createContext<{
  blocker: PricingDraftBlocker;
  owner?: string;
  register: (id: string, dirty: boolean) => void;
} | null>(null);

export function usePricingDraftBlocker(dirty: boolean): PricingDraftBlocker {
  const context = useContext(PricingDraftContext);
  if (!context) throw new Error('PricingDraftNavigation is required.');
  const { register, owner, blocker } = context;
  const id = useId();
  useLayoutEffect(() => {
    register(id, dirty);
    return () => register(id, false);
  }, [id, dirty, register]);
  return owner === id ? blocker : idle;
}
