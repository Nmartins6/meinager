import { z } from 'zod';
import { apiRequest } from '@/lib/api';

const moneySchema = z.string().regex(/^-?\d+\.\d{2}$/);

const financialPeriodSchema = z.object({
  id: z.string().uuid(),
  year: z.number().int().min(1).max(9999),
  month: z.number().int().min(1).max(12),
  status: z.enum(['OPEN', 'CLOSED']),
  revenueSource: z.enum(['ENTRIES', 'MANUAL_TOTAL']),
  manualRevenue: moneySchema.nullable(),
  closedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const financialPeriodsSchema = z.array(financialPeriodSchema);

const financialSummarySchema = z.object({
  period: z.object({
    id: z.string().uuid(),
    year: z.number().int().min(1).max(9999),
    month: z.number().int().min(1).max(12),
    status: z.enum(['OPEN', 'CLOSED']),
    revenueSource: z.enum(['ENTRIES', 'MANUAL_TOTAL']),
    manualRevenue: moneySchema.nullable(),
  }),
  totals: z.object({
    revenue: moneySchema,
    fixedExpenses: moneySchema,
    variableExpenses: moneySchema,
    contributionMargin: moneySchema,
    result: moneySchema,
    resultStatus: z.enum(['POSITIVE', 'NEGATIVE', 'NEUTRAL']),
  }),
  entryCounts: z.object({
    revenue: z.number().int().nonnegative(),
    fixedExpenses: z.number().int().nonnegative(),
    variableExpenses: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
});

export type FinancialPeriod = z.infer<typeof financialPeriodSchema>;
export type FinancialSummary = z.infer<typeof financialSummarySchema>;

export interface ListFinancialPeriodsInput {
  year?: number;
  status?: 'OPEN' | 'CLOSED';
  revenueSource?: 'ENTRIES' | 'MANUAL_TOTAL';
}

export interface CreateFinancialPeriodInput {
  year: number;
  month: number;
  revenueSource: 'ENTRIES' | 'MANUAL_TOTAL';
  manualRevenue?: string;
}

export interface UpdateFinancialPeriodInput {
  revenueSource?: 'ENTRIES' | 'MANUAL_TOTAL';
  manualRevenue?: string;
}

export async function getFinancialPeriods(
  input: ListFinancialPeriodsInput = {},
): Promise<FinancialPeriod[]> {
  const parameters = new URLSearchParams();

  if (input.year !== undefined) {
    parameters.set('year', String(input.year));
  }

  if (input.status) {
    parameters.set('status', input.status);
  }

  if (input.revenueSource) {
    parameters.set('revenueSource', input.revenueSource);
  }

  const query = parameters.toString();
  const response = await apiRequest(`/finance/periods${query ? `?${query}` : ''}`);

  return financialPeriodsSchema.parse(await response.json());
}

export async function createFinancialPeriod(
  input: CreateFinancialPeriodInput,
): Promise<FinancialPeriod> {
  const response = await apiRequest('/finance/periods', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return financialPeriodSchema.parse(await response.json());
}

export async function getFinancialPeriodSummary(periodId: string): Promise<FinancialSummary> {
  const response = await apiRequest(`/finance/periods/${periodId}/summary`);

  return financialSummarySchema.parse(await response.json());
}

export async function updateFinancialPeriod(
  periodId: string,
  input: UpdateFinancialPeriodInput,
): Promise<FinancialPeriod> {
  const response = await apiRequest(`/finance/periods/${periodId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return financialPeriodSchema.parse(await response.json());
}

export async function closeFinancialPeriod(periodId: string): Promise<FinancialPeriod> {
  const response = await apiRequest(`/finance/periods/${periodId}/close`, {
    method: 'POST',
  });

  return financialPeriodSchema.parse(await response.json());
}

export async function reopenFinancialPeriod(periodId: string): Promise<FinancialPeriod> {
  const response = await apiRequest(`/finance/periods/${periodId}/reopen`, {
    method: 'POST',
  });

  return financialPeriodSchema.parse(await response.json());
}
