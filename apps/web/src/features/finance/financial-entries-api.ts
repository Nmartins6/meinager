import { z } from 'zod';

import { apiRequest } from '@/lib/api';

const moneySchema = z.string().regex(/^\d+\.\d{2}$/);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const financialEntryStatusSchema = z.enum(['PENDING', 'PARTIAL', 'SETTLED', 'CANCELLED']);

const financialEntryOriginSchema = z.enum(['MANUAL', 'DUPLICATED', 'ORDER', 'ADJUSTMENT']);

const financialCategoryTypeSchema = z.enum(['REVENUE', 'FIXED_EXPENSE', 'VARIABLE_EXPENSE']);

const financialEntrySchema = z.object({
  id: z.string().uuid(),
  description: z.string(),
  amount: moneySchema,
  dueDate: dateSchema,
  status: financialEntryStatusSchema,
  origin: financialEntryOriginSchema,
  sourceEntryId: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  cancelledAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  period: z.object({
    id: z.string().uuid(),
    year: z.number().int(),
    month: z.number().int(),
    status: z.enum(['OPEN', 'CLOSED']),
  }),
  category: z.object({
    id: z.string().uuid(),
    name: z.string(),
    type: financialCategoryTypeSchema,
  }),
  client: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      type: z.enum(['INDIVIDUAL', 'COMPANY']),
    })
    .nullable(),
});

const financialEntriesResponseSchema = z.object({
  data: z.array(financialEntrySchema),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});

export type FinancialEntry = z.infer<typeof financialEntrySchema>;
export type FinancialEntriesResponse = z.infer<typeof financialEntriesResponseSchema>;
export type FinancialEntryStatus = z.infer<typeof financialEntryStatusSchema>;
export type FinancialEntryOrigin = z.infer<typeof financialEntryOriginSchema>;
export type FinancialEntryCategoryType = z.infer<typeof financialCategoryTypeSchema>;

export interface ListFinancialEntriesInput {
  search?: string;
  periodId?: string;
  categoryId?: string;
  clientId?: string;
  categoryType?: FinancialEntryCategoryType;
  status?: FinancialEntryStatus;
  dueFrom?: string;
  dueTo?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateFinancialEntryInput {
  periodId: string;
  categoryId: string;
  clientId?: string | null;
  description: string;
  amount: string;
  dueDate: string;
  notes?: string | null;
}

export interface UpdateFinancialEntryInput {
  categoryId?: string;
  clientId?: string | null;
  description?: string;
  amount?: string;
  dueDate?: string;
  notes?: string | null;
}

export interface CancelFinancialEntryInput {
  reason: string;
}

export async function getFinancialEntries(
  input: ListFinancialEntriesInput = {},
): Promise<FinancialEntriesResponse> {
  const parameters = new URLSearchParams();

  if (input.search) {
    parameters.set('search', input.search);
  }

  if (input.periodId) {
    parameters.set('periodId', input.periodId);
  }

  if (input.categoryId) {
    parameters.set('categoryId', input.categoryId);
  }

  if (input.clientId) {
    parameters.set('clientId', input.clientId);
  }

  if (input.categoryType) {
    parameters.set('categoryType', input.categoryType);
  }

  if (input.status) {
    parameters.set('status', input.status);
  }

  if (input.dueFrom) {
    parameters.set('dueFrom', input.dueFrom);
  }

  if (input.dueTo) {
    parameters.set('dueTo', input.dueTo);
  }

  parameters.set('page', String(input.page ?? 1));
  parameters.set('pageSize', String(input.pageSize ?? 20));

  const response = await apiRequest(`/finance/entries?${parameters.toString()}`);

  return financialEntriesResponseSchema.parse(await response.json());
}

export async function getFinancialEntry(entryId: string): Promise<FinancialEntry> {
  const response = await apiRequest(`/finance/entries/${entryId}`);

  return financialEntrySchema.parse(await response.json());
}

export async function createFinancialEntry(
  input: CreateFinancialEntryInput,
): Promise<FinancialEntry> {
  const response = await apiRequest('/finance/entries', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return financialEntrySchema.parse(await response.json());
}

export async function updateFinancialEntry(
  entryId: string,
  input: UpdateFinancialEntryInput,
): Promise<FinancialEntry> {
  const response = await apiRequest(`/finance/entries/${entryId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return financialEntrySchema.parse(await response.json());
}

export async function cancelFinancialEntry(
  entryId: string,
  input: CancelFinancialEntryInput,
): Promise<FinancialEntry> {
  const response = await apiRequest(`/finance/entries/${entryId}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return financialEntrySchema.parse(await response.json());
}

export async function duplicateFinancialEntryToNextMonth(entryId: string): Promise<FinancialEntry> {
  const response = await apiRequest(`/finance/entries/${entryId}/duplicate-next-month`, {
    method: 'POST',
  });

  return financialEntrySchema.parse(await response.json());
}
