import { useQuery } from '@tanstack/react-query';
import { getFinancialPeriodSummary } from './finance-api';

export function useFinancialSummaryQuery(periodId?: string) {
  return useQuery({
    queryKey: ['finance', 'periods', periodId, 'summary'],
    queryFn: () => {
      if (!periodId) {
        throw new Error('Selecione uma competência financeira.');
      }

      return getFinancialPeriodSummary(periodId);
    },
    enabled: Boolean(periodId),
  });
}
