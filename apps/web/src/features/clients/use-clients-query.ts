import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getClients, type ListClientsInput } from './clients-api';

export function useClientsQuery(input: ListClientsInput) {
  return useQuery({
    queryKey: ['clients', input],
    queryFn: () => getClients(input),
    placeholderData: keepPreviousData,
  });
}
