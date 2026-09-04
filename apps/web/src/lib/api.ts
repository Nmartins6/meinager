import { z } from 'zod';

const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('meinager-api'),
  database: z.literal('up'),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '');

if (!apiUrl) {
  throw new Error('VITE_API_URL is not configured');
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${apiUrl}/health`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  return healthResponseSchema.parse(await response.json());
}
