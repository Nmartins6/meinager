import type { z } from 'zod';

export async function parsePricingResponse<T>(
  response: Response,
  schema: z.ZodType<T>,
): Promise<T> {
  try {
    return schema.parse(await response.json());
  } catch {
    throw new Error('Não foi possível validar a resposta de precificação. Tente novamente.');
  }
}
