import { useMutation, useQueryClient } from '@tanstack/react-query';
import { login } from '@/lib/api';

export function useLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
    },
  });
}
