import { z } from 'zod';

import { apiRequest } from '@/lib/api';

const financialCategoryTypeSchema = z.enum(['REVENUE', 'FIXED_EXPENSE', 'VARIABLE_EXPENSE']);

const financialCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: financialCategoryTypeSchema,
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const financialCategoriesSchema = z.array(financialCategorySchema);

export type FinancialCategory = z.infer<typeof financialCategorySchema>;
export type FinancialCategoryType = z.infer<typeof financialCategoryTypeSchema>;

export interface ListFinancialCategoriesInput {
  search?: string;
  type?: FinancialCategoryType;
  isActive?: boolean;
}

export interface CreateFinancialCategoryInput {
  name: string;
  type: FinancialCategoryType;
}

export interface UpdateFinancialCategoryInput {
  name?: string;
  isActive?: boolean;
}

export async function getFinancialCategories(
  input: ListFinancialCategoriesInput = {},
): Promise<FinancialCategory[]> {
  const parameters = new URLSearchParams();

  if (input.search) {
    parameters.set('search', input.search);
  }

  if (input.type) {
    parameters.set('type', input.type);
  }

  if (input.isActive !== undefined) {
    parameters.set('isActive', String(input.isActive));
  }

  const query = parameters.toString();
  const response = await apiRequest(`/finance/categories${query ? `?${query}` : ''}`);

  return financialCategoriesSchema.parse(await response.json());
}

export async function createFinancialCategory(
  input: CreateFinancialCategoryInput,
): Promise<FinancialCategory> {
  const response = await apiRequest('/finance/categories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return financialCategorySchema.parse(await response.json());
}

export async function updateFinancialCategory(
  categoryId: string,
  input: UpdateFinancialCategoryInput,
): Promise<FinancialCategory> {
  const response = await apiRequest(`/finance/categories/${categoryId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return financialCategorySchema.parse(await response.json());
}
