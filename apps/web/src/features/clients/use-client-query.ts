import { useQuery } from '@tanstack/react-query';
import { getClient } from './clients-api';

export function useClientQuery(clientId: string) {
  return useQuery({
    queryKey: ['clients', clientId],
    queryFn: () => getClient(clientId),
    enabled: clientId.length > 0,
  });
}
