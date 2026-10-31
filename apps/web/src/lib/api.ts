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

const organizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  role: z.enum(['OWNER', 'ADMIN', 'FINANCE', 'OPERATIONS', 'VIEWER']),
});

const authResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
  }),
  organization: organizationSchema.nullable(),
  organizations: z.array(organizationSchema).optional(),
  contextVersion: z.number().int().nonnegative().default(0),
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
const organizationStorageKey = 'meinager-active-organization-id';

function readOrganizationContext(): { id: string; version: number } | null {
  const stored = window.sessionStorage.getItem(organizationStorageKey);
  if (!stored) return null;
  try {
    const parsed = z
      .object({ id: z.string().uuid(), version: z.number().int().nonnegative() })
      .strict()
      .safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function setOrganizationContext(id: string | null, version = 0) {
  if (id) window.sessionStorage.setItem(organizationStorageKey, JSON.stringify({ id, version }));
  else window.sessionStorage.removeItem(organizationStorageKey);
}

export function getOrganizationContext(): string | null {
  return readOrganizationContext()?.id ?? null;
}

export function getOrganizationContextVersion(): number | null {
  return readOrganizationContext()?.version ?? null;
}

if (!apiUrl) {
  throw new Error('VITE_API_URL is not configured');
}

export async function apiRequest(path: string, init?: RequestInit): Promise<Response> {
  const organizationContext = readOrganizationContext();
  const organizationalRequest = !path.startsWith('/auth/');
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(organizationalRequest && organizationContext
        ? {
            'X-Organization-Context': organizationContext.id,
            'X-Organization-Context-Version': String(organizationContext.version),
          }
        : {}),
      ...init?.headers,
    },
  });

  const currentContext = readOrganizationContext();
  if (
    organizationalRequest &&
    organizationContext &&
    (currentContext?.id !== organizationContext.id ||
      currentContext.version !== organizationContext.version)
  ) {
    throw new ApiError(
      'O contexto da organização mudou. Verifique o resultado na organização anterior.',
      409,
    );
  }

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

  const result = authResponseSchema.parse(await response.json());
  setOrganizationContext(result.organization?.id ?? null, result.contextVersion);
  return result;
}

export async function getCurrentUser(): Promise<AuthResponse> {
  const response = await apiRequest('/auth/me');

  const result = authResponseSchema.parse(await response.json());
  // Do not overwrite an old tab's context before its stale requests are rejected.
  const current = readOrganizationContext();
  if (
    !current ||
    (current.id === result.organization?.id && result.contextVersion >= current.version)
  )
    setOrganizationContext(result.organization?.id ?? null, result.contextVersion);
  return result;
}

export async function logout(): Promise<void> {
  await apiRequest('/auth/logout', {
    method: 'POST',
  });
  setOrganizationContext(null);
}

export async function selectOrganization(organizationId: string): Promise<AuthResponse> {
  const response = await apiRequest('/auth/organization', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationId }),
  });
  const result = authResponseSchema.parse(await response.json());
  setOrganizationContext(result.organization?.id ?? null, result.contextVersion);
  return result;
}

export async function registerAccount(input: RegisterInput): Promise<AuthResponse> {
  const response = await apiRequest('/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const result = authResponseSchema.parse(await response.json());
  setOrganizationContext(result.organization?.id ?? null, result.contextVersion);
  return result;
}
