import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createOrderWorkflow, type CreateOrderWorkflowInput } from './order-workflows-api';

export function useCreateOrderWorkflowMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateOrderWorkflowInput) => createOrderWorkflow(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['order-workflows', 'list'],
      });
    },
  });
}
