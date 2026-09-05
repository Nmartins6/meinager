import { z } from 'zod';
import { apiRequest } from '@/lib/api';

const clientSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['INDIVIDUAL', 'COMPANY']),
  name: z.string(),
  document: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  notes: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export interface CreateClientInput {
  type: 'INDIVIDUAL' | 'COMPANY';
  name: string;
  document?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface UpdateClientInput {
  type?: 'INDIVIDUAL' | 'COMPANY';
  name?: string;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

const clientsResponseSchema = z.object({
  data: z.array(clientSchema),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});

export type Client = z.infer<typeof clientSchema>;
export type ClientsResponse = z.infer<typeof clientsResponseSchema>;

export interface ListClientsInput {
  search?: string;
  type?: 'INDIVIDUAL' | 'COMPANY';
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export async function getClients(input: ListClientsInput = {}): Promise<ClientsResponse> {
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

  parameters.set('page', String(input.page ?? 1));
  parameters.set('pageSize', String(input.pageSize ?? 20));

  const response = await apiRequest(`/clients?${parameters.toString()}`);

  return clientsResponseSchema.parse(await response.json());
}

export async function createClient(input: CreateClientInput): Promise<Client> {
  const response = await apiRequest('/clients', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return clientSchema.parse(await response.json());
}

export async function getClient(clientId: string): Promise<Client> {
  const response = await apiRequest(`/clients/${clientId}`);

  return clientSchema.parse(await response.json());
}

export async function updateClient(clientId: string, input: UpdateClientInput): Promise<Client> {
  const response = await apiRequest(`/clients/${clientId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return clientSchema.parse(await response.json());
}
