import { useContext, useMemo, useState, type ReactNode } from 'react';
import { useBlocker } from 'react-router-dom';
import { PricingDraftContext } from './use-pricing-draft-blocker';

function DraftNavigationRoot({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<ReadonlySet<string>>(new Set());
  const owner = [...drafts][0];
  const blocker = useBlocker(owner !== undefined);
  const register = useMemo(
    () => (id: string, dirty: boolean) => {
      setDrafts((current) => {
        if (current.has(id) === dirty) return current;
        const next = new Set(current);
        if (dirty) next.add(id);
        else next.delete(id);
        return next;
      });
    },
    [],
  );
  return (
    <PricingDraftContext.Provider value={{ blocker, owner, register }}>
      {children}
    </PricingDraftContext.Provider>
  );
}

// Standalone forms own one guard; forms on the guided page share its guard.
export function PricingDraftNavigation({ children }: { children: ReactNode }) {
  const parent = useContext(PricingDraftContext);
  return parent ? children : <DraftNavigationRoot>{children}</DraftNavigationRoot>;
}
