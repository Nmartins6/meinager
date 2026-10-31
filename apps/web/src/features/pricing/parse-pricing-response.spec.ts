import { getPricingProductSummary } from './pricing-api';
import { getPricingComposition } from './pricing-composition-api';
import { getPricingConfiguration } from './pricing-configuration-api';
import { listPricingProfiles } from './pricing-profiles-api';

const productId = '11111111-1111-4111-8111-111111111111';

afterEach(() => vi.unstubAllGlobals());

it.each([
  ['resumo comercial', () => getPricingProductSummary(productId)],
  ['configuração', () => getPricingConfiguration()],
  ['composição', () => getPricingComposition(productId)],
  ['perfis', () => listPricingProfiles({ page: 1, pageSize: 20 })],
])('does not expose schema diagnostics from an invalid %s response', async (_name, request) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ sql: 'SELECT private_cost FROM products' }))),
  );
  await expect(request()).rejects.toThrow(
    'Não foi possível validar a resposta de precificação. Tente novamente.',
  );
});
