import { useQuery } from '@tanstack/react-query';

import { getFinancialSettlements } from './financial-settlements-api';

export function useFinancialSettlementsQuery(entryId?: string) {
  return useQuery({
    queryKey: ['finance', 'settlements', entryId],
    queryFn: () => {
      if (!entryId) {
        throw new Error('Selecione um lançamento financeiro.');
      }

      return getFinancialSettlements(entryId);
    },
    enabled: Boolean(entryId),
  });
}
