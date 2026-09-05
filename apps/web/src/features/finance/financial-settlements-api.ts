import { z } from 'zod';

import { apiRequest } from '@/lib/api';

const moneySchema = z.string().regex(/^\d+\.\d{2}$/);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const accountTypeSchema = z.enum([
  'CASH',
  'CHECKING_ACCOUNT',
  'SAVINGS_ACCOUNT',
  'DIGITAL_WALLET',
  'OTHER',
]);

const entryStatusSchema = z.enum(['PENDING', 'PARTIAL', 'SETTLED', 'CANCELLED']);

const financialSettlementSchema = z.object({
  id: z.string().uuid(),
  amount: moneySchema,
  settledAt: dateSchema,
  notes: z.string().nullable(),
  reversedAt: z.string().datetime().nullable(),
  reversalReason: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  account: z.object({
    id: z.string().uuid(),
    name: z.string(),
    type: accountTypeSchema,
  }),
});

const financialSettlementEntrySummarySchema = z.object({
  id: z.string().uuid(),
  status: entryStatusSchema,
  amount: moneySchema,
  settledAmount: moneySchema,
  remainingAmount: moneySchema,
});

const financialSettlementResponseSchema = z.object({
  settlement: financialSettlementSchema,
  entry: financialSettlementEntrySummarySchema,
});

const financialSettlementsResponseSchema = z.object({
  data: z.array(financialSettlementSchema),
  entry: financialSettlementEntrySummarySchema,
});

export type FinancialSettlement = z.infer<typeof financialSettlementSchema>;
export type FinancialSettlementEntrySummary = z.infer<typeof financialSettlementEntrySummarySchema>;
export type FinancialSettlementResponse = z.infer<typeof financialSettlementResponseSchema>;
export type FinancialSettlementsResponse = z.infer<typeof financialSettlementsResponseSchema>;

export interface CreateFinancialSettlementInput {
  accountId: string;
  amount: string;
  settledAt: string;
  notes?: string;
}

export interface ReverseFinancialSettlementInput {
  reason: string;
}

export async function getFinancialSettlements(
  entryId: string,
): Promise<FinancialSettlementsResponse> {
  const response = await apiRequest(`/finance/entries/${entryId}/settlements`);

  return financialSettlementsResponseSchema.parse(await response.json());
}

export async function createFinancialSettlement(
  entryId: string,
  input: CreateFinancialSettlementInput,
): Promise<FinancialSettlementResponse> {
  const response = await apiRequest(`/finance/entries/${entryId}/settlements`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return financialSettlementResponseSchema.parse(await response.json());
}

export async function reverseFinancialSettlement(
  settlementId: string,
  input: ReverseFinancialSettlementInput,
): Promise<FinancialSettlementResponse> {
  const response = await apiRequest(`/finance/settlements/${settlementId}/reverse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return financialSettlementResponseSchema.parse(await response.json());
}
