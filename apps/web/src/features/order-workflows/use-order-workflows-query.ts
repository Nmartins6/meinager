import { useQuery } from '@tanstack/react-query';

import { getOrderWorkflows } from './order-workflows-api';

export function useOrderWorkflowsQuery(enabled = true) {
  return useQuery({
    queryKey: ['order-workflows', 'list'],
    queryFn: getOrderWorkflows,
    enabled,
  });
}
