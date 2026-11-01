import { z } from 'zod';

import { apiRequest } from '@/lib/api';

const orderStatusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);

const orderStageCategorySchema = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']);

const orderStageSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  position: z.number().int().positive(),
  category: orderStageCategorySchema,
});

const orderWorkflowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

const orderStageTransitionSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['CREATED', 'ADVANCED', 'CANCELLED']),
  createdAt: z.string().datetime(),
  previousStage: orderStageSchema.nullable(),
  nextStage: orderStageSchema.nullable(),
  actor: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
    })
    .nullable(),
});

const orderClientSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(['INDIVIDUAL', 'COMPANY']),
});

const orderQuoteSchema = z.object({
  id: z.string().uuid(),
  number: z.number().int().positive(),
});

const orderItemSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid().nullable(),
  priceOrigin: z.enum(['CATALOG', 'MANUAL']).nullable(),
  pricingVersionId: z.string().uuid().nullable(),
  position: z.number().int().positive(),
  description: z.string(),
  unit: z.string(),
  quantity: z.string(),
  unitPrice: z.string(),
  total: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const orderSummarySchema = z.object({
  id: z.string().uuid(),
  number: z.number().int().positive(),
  status: orderStatusSchema,
  subtotal: z.string(),
  discount: z.string(),
  total: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  workflow: orderWorkflowSchema,
  currentStage: orderStageSchema,
  quote: orderQuoteSchema,
  client: orderClientSchema,
  _count: z.object({
    items: z.number().int().min(0),
  }),
});

const orderSchema = z.object({
  id: z.string().uuid(),
  number: z.number().int().positive(),
  status: orderStatusSchema,
  subtotal: z.string(),
  discount: z.string(),
  total: z.string(),
  notes: z.string().nullable(),
  cancelledAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  workflow: orderWorkflowSchema,
  currentStage: orderStageSchema,
  quote: orderQuoteSchema,
  client: orderClientSchema,
  items: z.array(orderItemSchema),
  stageTransitions: z.array(orderStageTransitionSchema),
});

const ordersResponseSchema = z.object({
  data: z.array(orderSummarySchema),
  pagination: z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  }),
});

export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type Order = z.infer<typeof orderSchema>;
export type OrderSummary = z.infer<typeof orderSummarySchema>;
export type OrdersResponse = z.infer<typeof ordersResponseSchema>;

export interface ListOrdersInput {
  status?: OrderStatus;
  clientId?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateOrderFromQuoteInput {
  quoteId: string;
}

export type OrderLifecycleAction = 'advance' | 'cancel';

export async function getOrders(input: ListOrdersInput = {}): Promise<OrdersResponse> {
  const parameters = new URLSearchParams();

  if (input.status) {
    parameters.set('status', input.status);
  }

  if (input.clientId) {
    parameters.set('clientId', input.clientId);
  }

  parameters.set('page', String(input.page ?? 1));
  parameters.set('pageSize', String(input.pageSize ?? 20));

  const response = await apiRequest(`/orders?${parameters.toString()}`);

  return ordersResponseSchema.parse(await response.json());
}

export async function getOrder(orderId: string): Promise<Order> {
  const response = await apiRequest(`/orders/${encodeURIComponent(orderId)}`);

  return orderSchema.parse(await response.json());
}

export async function createOrderFromQuote(input: CreateOrderFromQuoteInput): Promise<Order> {
  const response = await apiRequest('/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return orderSchema.parse(await response.json());
}

export async function transitionOrder(
  orderId: string,
  action: OrderLifecycleAction,
): Promise<Order> {
  const response = await apiRequest(`/orders/${encodeURIComponent(orderId)}/${action}`, {
    method: 'POST',
  });

  return orderSchema.parse(await response.json());
}

export interface CreateOrderFromQuoteInput {
  quoteId: string;
  workflowId?: string;
}
