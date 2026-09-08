import { z } from 'zod';

import { apiRequest } from '@/lib/api';

const stockMovementTypeSchema = z.enum(['IN', 'OUT']);
const stockMovementOriginSchema = z.enum(['MANUAL', 'ADJUSTMENT', 'REVERSAL']);

const paginationSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

const stockBalanceSchema = z.object({
  productId: z.string().uuid(),
  unit: z.string(),
  trackInventory: z.boolean(),
  minimumStock: z.string().nullable(),
  totalIn: z.string(),
  totalOut: z.string(),
  balance: z.string(),
  isBelowMinimum: z.boolean(),
});

const stockMovementSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  type: stockMovementTypeSchema,
  origin: stockMovementOriginSchema,
  quantity: z.string(),
  reason: z.string(),
  notes: z.string().nullable(),
  reversalOfId: z.string().uuid().nullable(),
  occurredAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

const stockMovementsResponseSchema = z.object({
  data: z.array(stockMovementSchema),
  pagination: paginationSchema,
});

const stockAdjustmentResponseSchema = z.object({
  productId: z.string().uuid(),
  previousBalance: z.string(),
  balance: z.string(),
  movement: stockMovementSchema.nullable(),
});

export type StockMovementType = z.infer<typeof stockMovementTypeSchema>;
export type StockMovementOrigin = z.infer<typeof stockMovementOriginSchema>;
export type StockBalance = z.infer<typeof stockBalanceSchema>;
export type StockMovement = z.infer<typeof stockMovementSchema>;
export type StockMovementsResponse = z.infer<typeof stockMovementsResponseSchema>;
export type StockAdjustmentResponse = z.infer<typeof stockAdjustmentResponseSchema>;

export interface ListStockMovementsInput {
  type?: StockMovementType;
  origin?: StockMovementOrigin;
  page?: number;
  pageSize?: number;
}

export interface CreateStockMovementInput {
  type: StockMovementType;
  quantity: string;
  reason: string;
  notes?: string;
}

export interface AdjustStockInput {
  countedQuantity: string;
  expectedBalance: string;
  reason: string;
  notes?: string;
}

export interface ReverseStockMovementInput {
  reason: string;
  notes?: string;
}

export async function getStockBalance(productId: string): Promise<StockBalance> {
  const response = await apiRequest(`/inventory/products/${encodeURIComponent(productId)}/balance`);

  return stockBalanceSchema.parse(await response.json());
}

export async function getStockMovements(
  productId: string,
  input: ListStockMovementsInput = {},
): Promise<StockMovementsResponse> {
  const parameters = new URLSearchParams();

  if (input.type) {
    parameters.set('type', input.type);
  }

  if (input.origin) {
    parameters.set('origin', input.origin);
  }

  parameters.set('page', String(input.page ?? 1));
  parameters.set('pageSize', String(input.pageSize ?? 20));

  const response = await apiRequest(
    `/inventory/products/${encodeURIComponent(productId)}/movements?${parameters.toString()}`,
  );

  return stockMovementsResponseSchema.parse(await response.json());
}

export async function createStockMovement(
  productId: string,
  input: CreateStockMovementInput,
): Promise<StockMovement> {
  const response = await apiRequest(
    `/inventory/products/${encodeURIComponent(productId)}/movements`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );

  return stockMovementSchema.parse(await response.json());
}

export async function adjustStock(
  productId: string,
  input: AdjustStockInput,
): Promise<StockAdjustmentResponse> {
  const response = await apiRequest(
    `/inventory/products/${encodeURIComponent(productId)}/adjustments`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );

  return stockAdjustmentResponseSchema.parse(await response.json());
}

export async function reverseStockMovement(
  productId: string,
  movementId: string,
  input: ReverseStockMovementInput,
): Promise<StockMovement> {
  const response = await apiRequest(
    `/inventory/products/${encodeURIComponent(productId)}/movements/${encodeURIComponent(
      movementId,
    )}/reverse`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );

  return stockMovementSchema.parse(await response.json());
}
