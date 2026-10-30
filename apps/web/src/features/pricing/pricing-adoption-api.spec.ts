import { adoptPricingVersion } from './pricing-adoption-api';
import {
  pricingAdoptionInputSchema,
  pricingAdoptionResponseSchema,
} from './pricing-adoption-contracts';

const productId = '11111111-1111-4111-8111-111111111111';
const versionId = '22222222-2222-4222-8222-222222222222';
const adoptionId = '33333333-3333-4333-8333-333333333333';
const userId = '44444444-4444-4444-8444-444444444444';
const responseBody = {
  product: {
    id: productId,
    currency: 'BRL',
    salePrice: '88.5',
    adoptedPricingVersionId: versionId,
  },
  adoption: {
    id: adoptionId,
    productId,
    versionId,
    previousVersionId: null,
    previousPrice: null,
    newPrice: '88.5',
    classification: 'BELOW_MINIMUM',
    belowMinimumConfirmed: true,
    justification: 'Aprovação excepcional',
    createdByUserId: userId,
    createdAt: '2026-10-27T12:00:00.000Z',
  },
};

afterEach(() => vi.unstubAllGlobals());

it('accepts only the normal or confirmed below-minimum payload', () => {
  expect(pricingAdoptionInputSchema.parse({ versionId })).toEqual({ versionId });
  expect(
    pricingAdoptionInputSchema.parse({
      versionId,
      belowMinimumConfirmed: true,
      justification: '  Motivo  ',
    }),
  ).toEqual({ versionId, belowMinimumConfirmed: true, justification: 'Motivo' });
  for (const input of [
    { versionId, newPrice: '1' },
    { versionId, isAdopted: true },
    { versionId, belowMinimumConfirmed: true },
    { versionId, belowMinimumConfirmed: true, justification: '   ' },
    { versionId, belowMinimumConfirmed: false },
  ]) {
    expect(pricingAdoptionInputSchema.safeParse(input).success).toBe(false);
  }
});

it('validates the complete response with canonical decimal strings', () => {
  expect(pricingAdoptionResponseSchema.parse(responseBody).product.salePrice).toBe('88.5');
  expect(pricingAdoptionResponseSchema.safeParse({ ...responseBody, sql: 'SELECT' }).success).toBe(
    false,
  );
  expect(pricingAdoptionResponseSchema.safeParse({ product: responseBody.product }).success).toBe(
    false,
  );
  expect(
    pricingAdoptionResponseSchema.safeParse({
      ...responseBody,
      product: { ...responseBody.product, salePrice: '1e-8' },
    }).success,
  ).toBe(false);
  expect(
    pricingAdoptionResponseSchema.safeParse({
      ...responseBody,
      product: { ...responseBody.product, salePrice: 0.00000001 },
    }).success,
  ).toBe(false);
});

it('posts only versionId for normal adoption and checks response identifiers', async () => {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(responseBody), { status: 201 }),
  );
  vi.stubGlobal('fetch', fetchMock);
  await expect(adoptPricingVersion(productId, { versionId })).resolves.toMatchObject(responseBody);
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe(`http://localhost:3000/api/pricing/products/${productId}/adoptions`);
  expect(init).toMatchObject({ method: 'POST' });
  expect(JSON.parse(String(init?.body))).toEqual({ versionId });
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ...responseBody,
            adoption: { ...responseBody.adoption, versionId: adoptionId },
          }),
          { status: 201 },
        ),
    ),
  );
  await expect(adoptPricingVersion(productId, { versionId })).rejects.toThrow(
    'Não foi possível validar a resposta da adoção.',
  );
});

it('preserves a valid idempotent response without inventing a new transition', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(responseBody))),
  );
  const first = await adoptPricingVersion(productId, { versionId });
  const second = await adoptPricingVersion(productId, { versionId });
  expect(second.adoption.id).toBe(first.adoption.id);
});
