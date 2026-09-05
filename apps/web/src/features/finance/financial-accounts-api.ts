import { z } from 'zod';

import { apiRequest } from '@/lib/api';

const moneySchema = z.string().regex(/^-?\d+\.\d{2}$/);

const financialAccountTypeSchema = z.enum([
  'CASH',
  'CHECKING_ACCOUNT',
  'SAVINGS_ACCOUNT',
  'DIGITAL_WALLET',
  'OTHER',
]);

const financialAccountSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: financialAccountTypeSchema,
  openingBalance: moneySchema,
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const financialAccountsSchema = z.array(financialAccountSchema);

export type FinancialAccount = z.infer<typeof financialAccountSchema>;
export type FinancialAccountType = z.infer<typeof financialAccountTypeSchema>;

export interface ListFinancialAccountsInput {
  search?: string;
  type?: FinancialAccountType;
  isActive?: boolean;
}

export interface CreateFinancialAccountInput {
  name: string;
  type: FinancialAccountType;
  openingBalance?: string;
}

export interface UpdateFinancialAccountInput {
  name?: string;
  openingBalance?: string;
  isActive?: boolean;
}

export async function getFinancialAccounts(
  input: ListFinancialAccountsInput = {},
): Promise<FinancialAccount[]> {
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
  const response = await apiRequest(`/finance/accounts${query ? `?${query}` : ''}`);

  return financialAccountsSchema.parse(await response.json());
}

export async function createFinancialAccount(
  input: CreateFinancialAccountInput,
): Promise<FinancialAccount> {
  const response = await apiRequest('/finance/accounts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return financialAccountSchema.parse(await response.json());
}

export async function updateFinancialAccount(
  accountId: string,
  input: UpdateFinancialAccountInput,
): Promise<FinancialAccount> {
  const response = await apiRequest(`/finance/accounts/${accountId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return financialAccountSchema.parse(await response.json());
}
