import { useQuery } from '@tanstack/react-query';

import { getActiveOrderWorkflows } from './order-workflows-api';

export function useActiveOrderWorkflowsQuery(enabled = true) {
  return useQuery({
    queryKey: ['order-workflows', 'active'],
    queryFn: getActiveOrderWorkflows,
    enabled,
  });
}
