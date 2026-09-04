import { useQuery } from '@tanstack/react-query';
import { getHealth } from '../../lib/api';

export function useHealthQuery() {
  return useQuery({
    queryKey: ['system', 'health'],
    queryFn: getHealth,
    retry: 1,
    refetchInterval: 30_000,
  });
}
