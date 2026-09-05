import { useQuery } from '@tanstack/react-query';

import {
  getFinancialCategories,
  type ListFinancialCategoriesInput,
} from './financial-categories-api';

export function useFinancialCategoriesQuery(input: ListFinancialCategoriesInput = {}) {
  return useQuery({
    queryKey: ['finance', 'categories', input],
    queryFn: () => getFinancialCategories(input),
  });
}
