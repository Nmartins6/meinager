import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from '@/lib/api';

export const currentUserQueryKey = ['auth', 'current-user'] as const;

export function useCurrentUserQuery() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 60_000,
  });
}
