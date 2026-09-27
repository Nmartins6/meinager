import { useMutation, useQueryClient } from '@tanstack/react-query';

import { runOrderWorkflowAction, type OrderWorkflowAction } from './order-workflows-api';

interface OrderWorkflowActionInput {
  workflowId: string;
  action: OrderWorkflowAction;
}

export function useOrderWorkflowActionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workflowId, action }: OrderWorkflowActionInput) =>
      runOrderWorkflowAction(workflowId, action),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['order-workflows'],
      });
    },
  });
}
