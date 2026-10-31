import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getCurrentUser, type AuthResponse } from '@/lib/api';

export const currentUserQueryKey = ['auth', 'current-user'] as const;

export function useSessionQuery() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 60_000,
  });
}

type ActiveAuthResponse = AuthResponse & {
  organization: NonNullable<AuthResponse['organization']>;
};

// Internal pages are mounted only under ProtectedRoute, which checks the active organization.
export function useCurrentUserQuery(): UseQueryResult<ActiveAuthResponse, Error> {
  return useSessionQuery() as UseQueryResult<ActiveAuthResponse, Error>;
}
