import { z } from 'zod';

import {
  pricingErrorResponseSchema,
  type PricingErrorCode,
} from '@/features/pricing/pricing-contracts';

const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('meinager-api'),
  database: z.literal('up'),
  timestamp: z.string().datetime(),
});

const authResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
  }),
  organization: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    role: z.enum(['OWNER', 'ADMIN', 'FINANCE', 'OPERATIONS', 'VIEWER']),
  }),
});

const legacyApiErrorSchema = z.object({
  message: z.union([z.string(), z.array(z.string())]),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  organizationName: string;
  document?: string;
  segment?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly statusCode: number;
  readonly code?: PricingErrorCode;
  readonly field?: string;
  readonly details?: Readonly<Record<string, string | number | boolean | null>>;

  constructor(
    message: string,
    status: number,
    structured?: {
      statusCode: number;
      code: PricingErrorCode;
      field?: string;
      details?: Record<string, string | number | boolean | null>;
    },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusCode = structured?.statusCode ?? status;
    this.code = structured?.code;
    this.field = structured?.field;
    this.details = structured?.details;
  }
}

const genericApiErrorMessage = 'Não foi possível concluir a solicitação.';

export function parseApiError(body: unknown, status: number): ApiError {
  const structured = pricingErrorResponseSchema.safeParse(body);

  if (structured.success) {
    return new ApiError(structured.data.message, status, structured.data);
  }

  if (typeof body === 'object' && body !== null && 'code' in body) {
    return new ApiError(genericApiErrorMessage, status);
  }

  const legacy = legacyApiErrorSchema.safeParse(body);
  const message = legacy.success
    ? Array.isArray(legacy.data.message)
      ? legacy.data.message.join(' ')
      : legacy.data.message
    : genericApiErrorMessage;

  return new ApiError(message, status);
}

const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '');

if (!apiUrl) {
  throw new Error('VITE_API_URL is not configured');
}

export async function apiRequest(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw parseApiError(body, response.status);
  }

  return response;
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await apiRequest('/health');

  return healthResponseSchema.parse(await response.json());
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const response = await apiRequest('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return authResponseSchema.parse(await response.json());
}

export async function getCurrentUser(): Promise<AuthResponse> {
  const response = await apiRequest('/auth/me');

  return authResponseSchema.parse(await response.json());
}

export async function logout(): Promise<void> {
  await apiRequest('/auth/logout', {
    method: 'POST',
  });
}

export async function registerAccount(input: RegisterInput): Promise<AuthResponse> {
  const response = await apiRequest('/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return authResponseSchema.parse(await response.json());
}
