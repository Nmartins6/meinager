import { useMutation, useQueryClient } from '@tanstack/react-query';

import { type UpdateOrderWorkflowInput, updateOrderWorkflow } from './order-workflows-api';

interface UpdateOrderWorkflowVariables {
  workflowId: string;
  input: UpdateOrderWorkflowInput;
}

export function useUpdateOrderWorkflowMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workflowId, input }: UpdateOrderWorkflowVariables) =>
      updateOrderWorkflow(workflowId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['order-workflows'],
      });
    },
  });
}
