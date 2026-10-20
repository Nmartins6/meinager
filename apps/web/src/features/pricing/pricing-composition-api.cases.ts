import { getPricingComposition, putPricingComposition } from './pricing-composition-api';

const productId = '11111111-1111-4111-8111-111111111111';
const emptyInput = {
  expectedRevision: null,
  profileId: null,
  desiredMargin: null,
  laborEnabled: false,
  timeMinutes: null,
  freightMode: null,
  freightUnitCost: null,
  freightTotalCost: null,
  freightQuantity: null,
  freightConsumedQuantity: null,
  parameterOrigins: {},
  components: [],
};

function response(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ statusCode: status, code, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('pricing composition API errors', () => {
  it('maps composition absence to null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(404, 'PRICING_COMPOSITION_NOT_FOUND', 'Ausente.')),
    );
    await expect(getPricingComposition(productId)).resolves.toBeNull();
  });

  it('does not confuse a missing product with an absent composition', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.')),
    );
    await expect(getPricingComposition(productId)).rejects.toMatchObject({
      status: 404,
      code: 'PRODUCT_NOT_FOUND',
    });
  });

  it.each([
    [400, 'VALIDATION_ERROR', 'Dados inválidos.'],
    [403, 'PRICING_FORBIDDEN', 'Acesso negado.'],
    [404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.'],
    [409, 'PRICING_REVISION_CONFLICT', 'Revisão desatualizada.'],
    [500, 'INTERNAL_ERROR', 'Falha interna.'],
  ] as const)('preserves a structured %i PUT error', async (status, code, message) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(status, code, message)),
    );
    const promise = putPricingComposition(productId, emptyInput);
    await expect(promise).rejects.toMatchObject({
      status,
      code,
      message,
    });
  });
});
