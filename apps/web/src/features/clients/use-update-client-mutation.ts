import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateClient, type UpdateClientInput } from './clients-api';

interface UpdateClientVariables {
  clientId: string;
  input: UpdateClientInput;
}

export function useUpdateClientMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, input }: UpdateClientVariables) => updateClient(clientId, input),
    onSuccess: async (client) => {
      queryClient.setQueryData(['clients', client.id], client);

      await queryClient.invalidateQueries({
        queryKey: ['clients'],
      });
    },
  });
}
