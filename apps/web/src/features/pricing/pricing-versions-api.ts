import { apiRequest } from '@/lib/api';

import {
  createPricingVersionInputSchema,
  createdPricingVersionSchema,
  pricingVersionDetailSchema,
  pricingVersionListSchema,
  type CreatePricingVersionInput,
} from './pricing-versions-contracts';

async function parseResponse<T>(response: Response, parse: (value: object) => T): Promise<T> {
  try {
    return parse(await response.json());
  } catch {
    throw new Error(
      'Não foi possível validar a resposta do histórico de precificação. Tente novamente.',
    );
  }
}

function versionsUrl(productId: string) {
  return `/pricing/products/${encodeURIComponent(productId)}/versions`;
}

export async function createPricingVersion(productId: string, input: CreatePricingVersionInput) {
  const payload = createPricingVersionInputSchema.parse(input);
  const response = await apiRequest(versionsUrl(productId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseResponse(response, (value) => {
    const created = createdPricingVersionSchema.parse(value);
    if (
      created.productId !== productId ||
      created.compositionRevision !== payload.expectedCompositionRevision
    ) {
      throw new Error('A versão recebida não corresponde à composição solicitada.');
    }
    return created;
  });
}

export async function listPricingVersions(productId: string, page: number, pageSize: number) {
  const parameters = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const response = await apiRequest(`${versionsUrl(productId)}?${parameters}`);
  return parseResponse(response, (value) => pricingVersionListSchema.parse(value));
}

export async function getPricingVersion(productId: string, versionId: string) {
  const response = await apiRequest(`${versionsUrl(productId)}/${encodeURIComponent(versionId)}`);
  return parseResponse(response, (value) => {
    const detail = pricingVersionDetailSchema.parse(value);
    if (detail.productId !== productId || detail.id !== versionId) {
      throw new Error('O detalhe recebido não corresponde à versão solicitada.');
    }
    return detail;
  });
}
