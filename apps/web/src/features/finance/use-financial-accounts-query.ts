import { useQuery } from '@tanstack/react-query';

import { getFinancialAccounts, type ListFinancialAccountsInput } from './financial-accounts-api';

export function useFinancialAccountsQuery(input: ListFinancialAccountsInput = {}) {
  return useQuery({
    queryKey: ['finance', 'accounts', input],
    queryFn: () => getFinancialAccounts(input),
  });
}
