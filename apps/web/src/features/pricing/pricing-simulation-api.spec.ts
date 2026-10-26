import { simulatePricing } from './pricing-simulation-api';
import { pricingSimulationResponseFixture } from './pricing-simulation-test-fixtures';

const productId = '11111111-1111-4111-8111-111111111111';

afterEach(() => vi.unstubAllGlobals());

describe('pricing simulation API', () => {
  it('posts the strict payload and validates the complete response', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify(pricingSimulationResponseFixture()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      simulatePricing(productId, { source: 'PERSISTED', adoptedPrice: '88.5' }),
    ).resolves.toMatchObject({ productId, formulaVersion: 'margin-divisor-v1' });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`http://localhost:3000/api/pricing/products/${productId}/simulations`);
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init?.body))).toEqual({
      source: 'PERSISTED',
      adoptedPrice: '88.5',
    });
  });

  it('rejects an incomplete server response instead of accepting partial data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (_input: RequestInfo | URL, _init?: RequestInit) =>
          new Response(JSON.stringify({ productId, source: 'PERSISTED' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
    await expect(simulatePricing(productId, { source: 'PERSISTED' })).rejects.toThrow(
      'Não foi possível validar a resposta da simulação. Tente novamente.',
    );
  });

  it('does not expose an unexpected response field or malformed JSON in the error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ ...pricingSimulationResponseFixture(), secretSql: 'SELECT *' }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
      ),
    );
    await expect(simulatePricing(productId, { source: 'PERSISTED' })).rejects.toThrow(
      'Não foi possível validar a resposta da simulação. Tente novamente.',
    );
  });
});
