import { z } from 'zod';

import { apiRequest } from '@/lib/api';

const quoteStatusSchema = z.enum(['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED']);

const quoteClientSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(['INDIVIDUAL', 'COMPANY']),
});

const quoteSummarySchema = z.object({
  id: z.string().uuid(),
  number: z.number().int().positive(),
  status: quoteStatusSchema,
  validUntil: z.string().datetime().nullable(),
  subtotal: z.string(),
  discount: z.string(),
  total: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  client: quoteClientSchema,
  _count: z.object({
    items: z.number().int().min(0),
  }),
});

const quotesResponseSchema = z.object({
  data: z.array(quoteSummarySchema),
  pagination: z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  }),
});

export type QuoteStatus = z.infer<typeof quoteStatusSchema>;
export type QuoteSummary = z.infer<typeof quoteSummarySchema>;
export type QuotesResponse = z.infer<typeof quotesResponseSchema>;

export interface ListQuotesInput {
  status?: QuoteStatus;
  clientId?: string;
  page?: number;
  pageSize?: number;
}

export async function getQuotes(input: ListQuotesInput = {}): Promise<QuotesResponse> {
  const parameters = new URLSearchParams();

  if (input.status) {
    parameters.set('status', input.status);
  }

  if (input.clientId) {
    parameters.set('clientId', input.clientId);
  }

  parameters.set('page', String(input.page ?? 1));
  parameters.set('pageSize', String(input.pageSize ?? 20));

  const response = await apiRequest(`/quotes?${parameters.toString()}`);

  return quotesResponseSchema.parse(await response.json());
}
