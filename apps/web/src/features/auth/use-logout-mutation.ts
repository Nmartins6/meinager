import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logout } from '@/lib/api';

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      void queryClient.cancelQueries().then(() => queryClient.clear());
    },
  });
}
