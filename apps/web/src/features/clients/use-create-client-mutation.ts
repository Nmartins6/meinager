import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from './clients-api';

export function useCreateClientMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createClient,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['clients'],
      });
    },
  });
}
