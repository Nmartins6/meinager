import { z } from 'zod';

import { apiRequest } from '@/lib/api';

const orderWorkflowStageCategorySchema = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']);

const orderWorkflowStageSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  position: z.number().int().positive(),
  category: orderWorkflowStageCategorySchema,
  isActive: z.boolean(),
});

const orderWorkflowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  stages: z.array(orderWorkflowStageSchema),
  _count: z.object({
    orders: z.number().int().min(0),
  }),
});

const orderWorkflowsSchema = z.array(orderWorkflowSchema);

export type OrderWorkflow = z.infer<typeof orderWorkflowSchema>;
export type OrderWorkflowStage = z.infer<typeof orderWorkflowStageSchema>;

export interface CreateOrderWorkflowInput {
  name: string;
  stages: Array<{
    name: string;
  }>;
}

export type UpdateOrderWorkflowInput = CreateOrderWorkflowInput;

export type OrderWorkflowAction = 'default' | 'activate' | 'deactivate';

export async function getOrderWorkflows(): Promise<OrderWorkflow[]> {
  const response = await apiRequest('/order-workflows');

  return orderWorkflowsSchema.parse(await response.json());
}

export async function getActiveOrderWorkflows(): Promise<OrderWorkflow[]> {
  const response = await apiRequest('/order-workflows/active');

  return orderWorkflowsSchema.parse(await response.json());
}

export async function createOrderWorkflow(input: CreateOrderWorkflowInput): Promise<OrderWorkflow> {
  const response = await apiRequest('/order-workflows', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return orderWorkflowSchema.parse(await response.json());
}

export async function updateOrderWorkflow(
  workflowId: string,
  input: UpdateOrderWorkflowInput,
): Promise<OrderWorkflow> {
  const response = await apiRequest(`/order-workflows/${encodeURIComponent(workflowId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return orderWorkflowSchema.parse(await response.json());
}

export async function runOrderWorkflowAction(
  workflowId: string,
  action: OrderWorkflowAction,
): Promise<OrderWorkflow> {
  const response = await apiRequest(
    `/order-workflows/${encodeURIComponent(workflowId)}/${action}`,
    {
      method: 'POST',
    },
  );

  return orderWorkflowSchema.parse(await response.json());
}
