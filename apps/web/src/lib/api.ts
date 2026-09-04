import { z } from 'zod';

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

const apiErrorSchema = z.object({
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

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '');

if (!apiUrl) {
  throw new Error('VITE_API_URL is not configured');
}

async function request(path: string, init?: RequestInit): Promise<Response> {
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
    const parsedError = apiErrorSchema.safeParse(body);

    const message = parsedError.success
      ? Array.isArray(parsedError.data.message)
        ? parsedError.data.message.join(' ')
        : parsedError.data.message
      : 'Não foi possível concluir a solicitação.';

    throw new ApiError(message, response.status);
  }

  return response;
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await request('/health');

  return healthResponseSchema.parse(await response.json());
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const response = await request('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return authResponseSchema.parse(await response.json());
}

export async function getCurrentUser(): Promise<AuthResponse> {
  const response = await request('/auth/me');

  return authResponseSchema.parse(await response.json());
}

export async function logout(): Promise<void> {
  await request('/auth/logout', {
    method: 'POST',
  });
}

export async function registerAccount(input: RegisterInput): Promise<AuthResponse> {
  const response = await request('/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return authResponseSchema.parse(await response.json());
}
