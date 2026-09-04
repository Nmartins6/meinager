import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logout } from '@/lib/api';
import { currentUserQueryKey } from './use-current-user-query';

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.removeQueries({
        queryKey: currentUserQueryKey,
      });
    },
  });
}
