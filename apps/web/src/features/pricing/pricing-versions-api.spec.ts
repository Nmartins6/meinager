import {
  createPricingVersion,
  getPricingVersion,
  listPricingVersions,
} from './pricing-versions-api';
import { pricingVersionFixture } from './pricing-versions-test-fixtures';

const productId = '11111111-1111-4111-8111-111111111111';
const created = pricingVersionFixture();
const {
  snapshot: _snapshot,
  components: _components,
  deductions: _deductions,
  ...withSnapshot
} = created;
const {
  organizationId: _organizationId,
  productId: _productId,
  compositionId: _compositionId,
  configurationRevisionId: _configurationRevisionId,
  profileRevisionId: _profileRevisionId,
  state: _state,
  componentCount: _componentCount,
  deductionCount: _deductionCount,
  ...listItem
} = withSnapshot;

afterEach(() => vi.unstubAllGlobals());

describe('pricing versions API', () => {
  it('POSTs only the allowed revision and optional commercial price', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify(created), { status: 201 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      createPricingVersion(productId, { expectedCompositionRevision: 3, adoptedPrice: '88.5' }),
    ).resolves.toMatchObject({ id: created.id, number: 4 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`http://localhost:3000/api/pricing/products/${productId}/versions`);
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init?.body))).toEqual({
      expectedCompositionRevision: 3,
      adoptedPrice: '88.5',
    });
    await expect(
      createPricingVersion(productId, { expectedCompositionRevision: 3 }),
    ).resolves.toMatchObject({ id: created.id });
    expect(JSON.parse(String(fetchMock.mock.calls[1]![1]?.body))).toEqual({
      expectedCompositionRevision: 3,
    });
  });

  it('GETs list and detail with query parameters and dynamic adoption', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(input).includes(`/${created.id}`)
              ? { ...created, isAdopted: true }
              : {
                  data: [{ ...listItem, isAdopted: false }],
                  pagination: { page: 2, pageSize: 20, total: 21, totalPages: 2 },
                },
          ),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    expect((await listPricingVersions(productId, 2, 20)).data[0]?.isAdopted).toBe(false);
    expect((await getPricingVersion(productId, created.id)).isAdopted).toBe(true);
    expect(fetchMock.mock.calls[0]![0]).toBe(
      `http://localhost:3000/api/pricing/products/${productId}/versions?page=2&pageSize=20`,
    );
    expect(fetchMock.mock.calls[1]![0]).toBe(
      `http://localhost:3000/api/pricing/products/${productId}/versions/${created.id}`,
    );
  });

  it('rejects incomplete or extra server fields with a safe error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ...created, isAdopted: true, secretSql: 'SELECT *' }), {
            status: 201,
          }),
      ),
    );
    await expect(
      createPricingVersion(productId, { expectedCompositionRevision: 3 }),
    ).rejects.toThrow(
      'Não foi possível validar a resposta do histórico de precificação. Tente novamente.',
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response(JSON.stringify({ data: [{}], pagination: {} }), { status: 200 }),
      ),
    );
    await expect(listPricingVersions(productId, 1, 20)).rejects.toThrow(
      'Não foi possível validar a resposta do histórico de precificação. Tente novamente.',
    );
  });

  it('rejects a valid version belonging to another product or revision', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (_input: RequestInfo | URL, init?: RequestInit) =>
          new Response(
            JSON.stringify(init?.method === 'POST' ? created : { ...created, isAdopted: false }),
            {
              status: init?.method === 'POST' ? 201 : 200,
            },
          ),
      ),
    );
    await expect(
      createPricingVersion('99999999-9999-4999-8999-999999999999', {
        expectedCompositionRevision: 3,
      }),
    ).rejects.toThrow('Não foi possível validar a resposta do histórico de precificação.');
    await expect(
      createPricingVersion(productId, { expectedCompositionRevision: 4 }),
    ).rejects.toThrow('Não foi possível validar a resposta do histórico de precificação.');
    await expect(
      getPricingVersion(productId, '99999999-9999-4999-8999-999999999999'),
    ).rejects.toThrow('Não foi possível validar a resposta do histórico de precificação.');
  });
});
