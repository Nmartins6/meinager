import { z } from 'zod';

import { apiRequest } from '@/lib/api';

const quoteStatusSchema = z.enum(['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED']);

const quoteOrderStatusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);

const quoteOrderSchema = z.object({
  id: z.string().uuid(),
  number: z.number().int().positive(),
  status: quoteOrderStatusSchema,
});

const quoteClientSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(['INDIVIDUAL', 'COMPANY']),
});

const quoteItemSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid().nullable(),
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

const quoteSummarySchema = z.object({
  id: z.string().uuid(),
  number: z.number().int().positive(),
  status: quoteStatusSchema,
  validUntil: z.string().datetime().nullable(),
  subtotal: z.string(),
  discount: z.string(),
  total: z.string(),
  createdAt: z.string().datetime(),
  order: quoteOrderSchema.nullable(),
  updatedAt: z.string().datetime(),
  client: quoteClientSchema,
  _count: z.object({
    items: z.number().int().min(0),
  }),
});

const quoteSchema = z.object({
  id: z.string().uuid(),
  number: z.number().int().positive(),
  status: quoteStatusSchema,
  validUntil: z.string().datetime().nullable(),
  subtotal: z.string(),
  discount: z.string(),
  total: z.string(),
  notes: z.string().nullable(),
  sentAt: z.string().datetime().nullable(),
  approvedAt: z.string().datetime().nullable(),
  rejectedAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  order: quoteOrderSchema.nullable(),
  updatedAt: z.string().datetime(),
  client: quoteClientSchema,
  items: z.array(quoteItemSchema),
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
export type Quote = z.infer<typeof quoteSchema>;
export type QuoteSummary = z.infer<typeof quoteSummarySchema>;
export type QuotesResponse = z.infer<typeof quotesResponseSchema>;

export interface ListQuotesInput {
  status?: QuoteStatus;
  clientId?: string;
  page?: number;
  pageSize?: number;
}

export interface QuoteItemInput {
  productId?: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  notes?: string;
}

export interface CreateQuoteInput {
  clientId: string;
  validUntil?: string;
  discount?: string;
  notes?: string;
  items: QuoteItemInput[];
}

export interface UpdateQuoteInput {
  clientId?: string;
  validUntil?: string | null;
  discount?: string | null;
  notes?: string | null;
  items?: QuoteItemInput[];
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

export async function createQuote(input: CreateQuoteInput): Promise<Quote> {
  const response = await apiRequest('/quotes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return quoteSchema.parse(await response.json());
}

export async function updateQuote(quoteId: string, input: UpdateQuoteInput): Promise<Quote> {
  const response = await apiRequest(`/quotes/${encodeURIComponent(quoteId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return quoteSchema.parse(await response.json());
}

export async function getQuote(quoteId: string): Promise<Quote> {
  const response = await apiRequest(`/quotes/${encodeURIComponent(quoteId)}`);

  return quoteSchema.parse(await response.json());
}

export type QuoteLifecycleAction = 'send' | 'approve' | 'reject' | 'cancel';

export async function transitionQuote(
  quoteId: string,
  action: QuoteLifecycleAction,
): Promise<Quote> {
  const response = await apiRequest(`/quotes/${encodeURIComponent(quoteId)}/${action}`, {
    method: 'POST',
  });

  return quoteSchema.parse(await response.json());
}
