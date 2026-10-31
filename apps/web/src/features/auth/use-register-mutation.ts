import { useMutation, useQueryClient } from '@tanstack/react-query';
import { registerAccount } from '@/lib/api';

export function useRegisterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: registerAccount,
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
    },
  });
}
