import { useQuery } from '@tanstack/react-query';
import { getFinancialPeriods, type ListFinancialPeriodsInput } from './finance-api';

export function useFinancialPeriodsQuery(input: ListFinancialPeriodsInput = {}) {
  return useQuery({
    queryKey: ['finance', 'periods', input],
    queryFn: () => getFinancialPeriods(input),
  });
}
