import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';

import type { Product } from '@/features/products/products-api';
import type { PricingComposition } from '@/features/pricing/pricing-composition-contracts';
import type { PricingConfiguration } from '@/features/pricing/pricing-configuration-contracts';
import type { PricingProfileItem } from '@/features/pricing/pricing-profiles-contracts';

import { ProductPricingPage } from './product-pricing-page';

const productId = 'f25c7c1a-bd29-438f-a940-77d89a93ec50';
const sourceProductId = '1e495f96-cfcd-4ea2-a05f-f84299dba483';
const profileId = '2a4a2c9f-6237-4c3c-9ab6-c12dd4eef76d';
const secondProfileId = '8a25a5b0-2e95-4398-ab40-9256141976b8';
const inactiveSourceProductId = '50257a7b-baf5-47bb-b1e3-b7ef5196f540';
const costlessProductId = '8444400c-3b40-4f8a-9686-391a6e2a848a';
const userId = '53a6ba71-77b9-4aca-9493-e08e7dd11b83';
const timestamp = '2026-10-19T12:00:00.000Z';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function auth(role: 'OWNER' | 'ADMIN' | 'OPERATIONS' | 'FINANCE' | 'VIEWER') {
  return {
    user: { id: userId, name: role, email: `${role.toLowerCase()}@meinager.local` },
    organization: {
      id: '9173bea8-0d7d-45ec-a08d-d1cbac34ceaf',
      name: 'Meinager',
      slug: 'meinager',
      role,
    },
  };
}

const targetProduct: Product = {
  id: productId,
  type: 'PRODUCT',
  name: 'Produto alvo',
  sku: null,
  barcode: null,
  unit: 'UN',
  directCost: '10',
  salePrice: null,
  trackInventory: false,
  minimumStock: null,
  notes: null,
  isActive: true,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const sourceProduct: Product = {
  ...targetProduct,
  id: sourceProductId,
  name: 'Insumo catálogo',
  unit: 'KG',
};
const costlessProduct: Product = {
  ...targetProduct,
  id: costlessProductId,
  name: 'Produto sem custo',
  directCost: undefined,
};
const inactiveSourceProduct: Product = {
  ...sourceProduct,
  id: inactiveSourceProductId,
  name: 'Insumo desativado',
  isActive: false,
};
const profile: PricingProfileItem = {
  id: profileId,
  isActive: true,
  createdAt: timestamp,
  updatedAt: timestamp,
  currentRevision: {
    id: '3c5b3195-8631-4ba1-810a-775cc41ded5d',
    revision: 1,
    name: 'Varejo',
    effectiveFrom: timestamp,
    createdAt: timestamp,
  },
};
const secondProfile: PricingProfileItem = {
  ...profile,
  id: secondProfileId,
  currentRevision: {
    ...profile.currentRevision,
    id: 'f15631ca-4ddf-411b-8dd7-c89eec3d334f',
    name: 'Atacado',
  },
};
const pricingConfiguration: PricingConfiguration = {
  id: '0c441c57-4771-447f-b518-fc7003f51a70',
  isActive: true,
  currentRevision: {
    id: '8b46a55c-2cda-4da5-8afc-240cb0e76be0',
    revision: 1,
    effectiveFrom: timestamp,
    currency: 'BRL',
    fixedCostMode: 'RATE',
    fixedCostRate: '0.1',
    monthlyFixedCost: null,
    averageMonthlyRevenue: null,
    monthlyLaborCost: '3300',
    productiveHours: '165',
    defaultDesiredMargin: '0.25',
    parameterOrigins: {
      fixedCostRate: {
        schemaVersion: 1,
        origin: 'MANUAL',
        source: null,
        referenceId: null,
        periodStart: null,
        periodEnd: null,
        criterion: null,
        measuredAt: null,
        confirmedByUserId: userId,
      },
      defaultDesiredMargin: {
        schemaVersion: 1,
        origin: 'MANUAL',
        source: null,
        referenceId: null,
        periodStart: null,
        periodEnd: null,
        criterion: null,
        measuredAt: null,
        confirmedByUserId: userId,
      },
    },
    createdAt: timestamp,
  },
};
const componentOrigin = {
  schemaVersion: 1 as const,
  source: null,
  referenceId: null,
  periodStart: null,
  periodEnd: null,
  criterion: null,
  measuredAt: null,
  confirmedByUserId: userId,
};
const composition: PricingComposition = {
  id: '4d91bfec-2e23-49cd-a2bf-58fe74c490a1',
  productId,
  revision: 2,
  profileId,
  desiredMargin: '0.25',
  laborEnabled: false,
  timeMinutes: null,
  freightMode: null,
  freightUnitCost: null,
  freightTotalCost: null,
  freightQuantity: null,
  freightConsumedQuantity: null,
  parameterOrigins: {
    desiredMargin: {
      schemaVersion: 1,
      origin: 'MANUAL',
      source: null,
      referenceId: null,
      periodStart: null,
      periodEnd: null,
      criterion: null,
      measuredAt: null,
      confirmedByUserId: userId,
    },
  },
  isActive: true,
  createdAt: timestamp,
  updatedAt: timestamp,
  components: [
    {
      id: '5aeab63d-6101-44d6-91ca-31afcf22eed9',
      position: 1,
      description: 'Embalagem',
      category: 'PACKAGING',
      unit: 'UN',
      quantity: '1',
      costSource: 'MANUAL',
      storedUnitCost: '2.5',
      sourceProductId: null,
      originDetails: componentOrigin,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ],
};

interface FetchOptions {
  role?: 'OWNER' | 'ADMIN' | 'OPERATIONS' | 'FINANCE' | 'VIEWER';
  product?: Product;
  initialComposition?: typeof composition | null;
  onPut?: (body: Record<string, unknown>) => Response;
  onCompositionGet?: (call: number) => Response;
  profilePages?: PricingProfileItem[][];
  catalogPages?: Product[][];
  onLinkedProfileGet?: (call: number, profileId: string) => Response | Promise<Response>;
  onConfigurationGet?: () => Response;
  onProductDetailGet?: (productId: string) => Response | undefined;
}

function setupFetch(options: FetchOptions = {}) {
  const requested: Array<{
    path: string;
    method: string;
    body?: Record<string, unknown>;
    search: string;
  }> = [];
  let compositionGets = 0;
  let linkedProfileGets = 0;
  let hasComposition = options.initialComposition !== null;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const body = init?.body
      ? (JSON.parse(String(init.body)) as Record<string, unknown>)
      : undefined;
    requested.push({ path: url.pathname, method, body, search: url.search });
    if (url.pathname === '/api/auth/me') return jsonResponse(auth(options.role ?? 'OWNER'));
    if (url.pathname === '/api/pricing/configuration') {
      return options.onConfigurationGet?.() ?? jsonResponse(pricingConfiguration);
    }
    if (url.pathname === `/api/pricing/products/${productId}/summary`) {
      return jsonResponse({
        productId,
        currency: 'BRL',
        salePrice: options.product?.salePrice ?? null,
        priceOrigin: 'MANUAL',
        hasComposition,
      });
    }
    if (url.pathname === `/api/pricing/products/${productId}/composition`) {
      if (method === 'PUT') {
        const response = options.onPut?.(body ?? {});
        if (response) return response;
        hasComposition = true;
        return jsonResponse({
          ...composition,
          revision: 1,
          profileId: null,
          components: [],
        });
      }
      compositionGets += 1;
      const response = options.onCompositionGet?.(compositionGets);
      if (response) return response;
      if (options.initialComposition === null) {
        return jsonResponse(
          {
            statusCode: 404,
            message: 'Composição não encontrada.',
            code: 'PRICING_COMPOSITION_NOT_FOUND',
          },
          404,
        );
      }
      return jsonResponse(options.initialComposition ?? composition);
    }
    if (url.pathname === `/api/products/${productId}`) {
      return jsonResponse(options.product ?? targetProduct);
    }
    if (url.pathname === '/api/products') {
      const pages = options.catalogPages ?? [[targetProduct, sourceProduct]];
      const page = Number(url.searchParams.get('page') ?? '1');
      const data = pages[page - 1] ?? [];
      return jsonResponse({
        data,
        pagination: {
          page,
          pageSize: 100,
          total: pages.reduce((total, items) => total + items.length, 0),
          totalPages: pages.length,
        },
      });
    }
    if (url.pathname.startsWith('/api/products/')) {
      const detailProductId = url.pathname.slice('/api/products/'.length);
      const response = options.onProductDetailGet?.(detailProductId);
      if (response) return response;
      if (detailProductId === sourceProductId) return jsonResponse(sourceProduct);
      throw new Error(`Unexpected product detail: ${detailProductId}`);
    }
    if (url.pathname === '/api/pricing/profiles') {
      const pages = options.profilePages ?? [[profile]];
      const page = Number(url.searchParams.get('page') ?? '1');
      const data = pages[page - 1] ?? [];
      const total = pages.reduce((count, items) => count + items.length, 0);
      return jsonResponse({
        data,
        pagination: {
          page,
          pageSize: 100,
          total,
          totalPages: total === 0 ? 0 : pages.length,
        },
      });
    }
    if (url.pathname.startsWith('/api/pricing/profiles/')) {
      linkedProfileGets += 1;
      const requestedProfileId = url.pathname.slice('/api/pricing/profiles/'.length);
      const response = options.onLinkedProfileGet?.(linkedProfileGets, requestedProfileId);
      if (response) return response;
      const listedProfile = (options.profilePages ?? [[profile]])
        .flat()
        .find((item) => item.id === requestedProfileId);
      const requestedProfile =
        listedProfile ??
        (requestedProfileId === profileId
          ? profile
          : requestedProfileId === secondProfileId
            ? secondProfile
            : undefined);
      if (!requestedProfile) {
        return jsonResponse(
          {
            statusCode: 404,
            message: 'Perfil não encontrado.',
            code: 'PRICING_PROFILE_NOT_FOUND',
          },
          404,
        );
      }
      return jsonResponse({
        ...requestedProfile,
        isActive: Boolean(listedProfile?.isActive),
        currentRevision: { ...requestedProfile.currentRevision, deductions: [] },
      });
    }
    throw new Error(`Unexpected request: ${method} ${url.pathname}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { requested, fetchMock };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      {
        path: '/app/produtos/:productId/precificacao',
        element: (
          <>
            <Link to="/fora">Sair da página</Link>
            <ProductPricingPage />
          </>
        ),
      },
      { path: '/fora', element: <p>Página externa</p> },
    ],
    { initialEntries: [`/app/produtos/${productId}/precificacao`] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { client, router };
}

afterEach(() => {
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ProductPricingPage composition editor', () => {
  it('lets VIEWER read only the commercial summary without internal pricing requests', async () => {
    const { requested } = setupFetch({ role: 'VIEWER' });
    renderPage();
    expect(await screen.findByText('Sem preço definido')).toBeInTheDocument();
    expect(screen.queryByText(/Composição de/)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(requested.map(({ path }) => path)).toEqual([
        '/api/auth/me',
        `/api/pricing/products/${productId}/summary`,
      ]);
    });
  });

  it('shows FINANCE a read-only composition and preserves its linked inactive profile', async () => {
    setupFetch({ role: 'FINANCE', profilePages: [[]] });
    renderPage();
    expect(await screen.findByLabelText('Nome')).toHaveValue('Embalagem');
    expect(screen.getByLabelText('Nome')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Salvar composição' })).not.toBeInTheDocument();
    expect(screen.getByText(/sem realizar alterações/)).toBeVisible();
    expect(await screen.findByRole('option', { name: 'Varejo (inativo)' })).toBeVisible();
    expect(screen.getByLabelText('Perfil de venda')).toHaveDisplayValue('Varejo (inativo)');
    expect(screen.getByText('O perfil de venda selecionado está inativo.')).toBeVisible();
  });

  it('loads every active profile page without duplicates and resolves a linked profile beyond the first page', async () => {
    const { requested } = setupFetch({
      initialComposition: { ...composition, profileId: secondProfileId },
      profilePages: [[profile], [profile, secondProfile]],
    });
    renderPage();
    expect(await screen.findByLabelText('Perfil de venda')).toHaveDisplayValue('Atacado');
    expect(screen.getAllByRole('option', { name: 'Varejo' })).toHaveLength(1);
    expect(screen.getByRole('option', { name: 'Atacado' })).toBeVisible();
    expect(
      requested.filter(({ path }) => path === '/api/pricing/profiles').map(({ search }) => search),
    ).toEqual(['?page=1&pageSize=100&isActive=true', '?page=2&pageSize=100&isActive=true']);
    expect(requested.some(({ path }) => path === `/api/pricing/profiles/${secondProfileId}`)).toBe(
      true,
    );
  });

  it('retries the linked inactive profile query and leaves the loading error after success', async () => {
    const user = userEvent.setup();
    let detailCalls = 0;
    setupFetch({
      profilePages: [[]],
      onLinkedProfileGet: (call) => {
        detailCalls = call;
        if (call === 1) {
          return jsonResponse(
            { statusCode: 500, message: 'Falha ao carregar perfil.', code: 'INTERNAL_ERROR' },
            500,
          );
        }
        return jsonResponse({
          ...profile,
          isActive: false,
          currentRevision: { ...profile.currentRevision, deductions: [] },
        });
      },
    });
    renderPage();
    expect(await screen.findByText('Falha ao carregar perfil.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente o perfil' }));
    expect(await screen.findByRole('option', { name: 'Varejo (inativo)' })).toBeVisible();
    expect(screen.getByLabelText('Perfil de venda')).toHaveDisplayValue('Varejo (inativo)');
    expect(screen.queryByText('Falha ao carregar perfil.')).not.toBeInTheDocument();
    expect(detailCalls).toBe(2);
  });

  it('preserves a dirty draft across focus recovery and reconnection without composition refetch', async () => {
    const user = userEvent.setup();
    const { requested } = setupFetch();
    renderPage();
    const margin = await screen.findByLabelText('Margem desejada (%)');
    await user.clear(margin);
    await user.type(margin, '27');
    const compositionGetCount = () =>
      requested.filter(
        ({ path, method }) =>
          path === `/api/pricing/products/${productId}/composition` && method === 'GET',
      ).length;
    const profileGetCount = () =>
      requested.filter(({ path }) => path === '/api/pricing/profiles').length;
    expect(compositionGetCount()).toBe(1);

    const profilesBeforeFocus = profileGetCount();
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await waitFor(() => expect(profileGetCount()).toBeGreaterThan(profilesBeforeFocus));
    expect(compositionGetCount()).toBe(1);
    expect(margin).toHaveValue('27');

    const profilesBeforeReconnect = profileGetCount();
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
    await waitFor(() => expect(profileGetCount()).toBeGreaterThan(profilesBeforeReconnect));
    expect(compositionGetCount()).toBe(1);
    expect(margin).toHaveValue('27');
  });

  it.each(['OWNER', 'ADMIN', 'OPERATIONS'] as const)(
    'shows %s an immediate local preview without any write or simulation request',
    async (role) => {
      const user = userEvent.setup();
      const { requested } = setupFetch({
        role,
        initialComposition: { ...composition, profileId: null },
      });
      renderPage();
      expect(await screen.findByText('margin-divisor-v1')).toBeVisible();
      expect(
        screen.getByText('Esta é uma prévia local. Nenhum preço ou versão será alterado.'),
      ).toBeVisible();

      const cost = screen.getByLabelText('Custo unitário persistido');
      await user.clear(cost);
      expect(await screen.findByText(/Complete os valores financeiros válidos/)).toBeVisible();
      expect(screen.queryByText('margin-divisor-v1')).not.toBeInTheDocument();
      await user.type(cost, '5');
      expect(await screen.findByText('margin-divisor-v1')).toBeVisible();

      expect(requested.some(({ path }) => path.endsWith('/simulations'))).toBe(false);
      expect(requested.every(({ method }) => method === 'GET')).toBe(true);
    },
  );

  it('removes and restores the local preview with the composition margin origin', async () => {
    const user = userEvent.setup();
    const { requested } = setupFetch({
      initialComposition: { ...composition, profileId: null },
    });
    renderPage();
    expect(await screen.findByText('margin-divisor-v1')).toBeVisible();

    const marginOrigin = screen.getByLabelText('Origem', {
      selector: '#desiredMargin-origin',
    });
    expect(marginOrigin).toHaveValue('MANUAL');
    await user.selectOptions(marginOrigin, '');
    expect(
      await screen.findByText(
        'Informe a origem da margem desejada da composição para atualizar a prévia.',
      ),
    ).toBeVisible();
    expect(screen.queryByText('margin-divisor-v1')).not.toBeInTheDocument();

    await user.selectOptions(marginOrigin, 'MANUAL');
    expect(await screen.findByText('margin-divisor-v1')).toBeVisible();
    expect(requested.every(({ method }) => method === 'GET')).toBe(true);
    expect(
      requested.some(({ path }) => path.endsWith('/simulations') || path.includes('/versions')),
    ).toBe(false);
  });

  it('shows FINANCE the complete preview in read-only mode', async () => {
    const { requested } = setupFetch({
      role: 'FINANCE',
      initialComposition: { ...composition, profileId: null },
    });
    renderPage();
    expect(await screen.findByText('margin-divisor-v1')).toBeVisible();
    expect(screen.getByLabelText('Custo unitário persistido')).toBeDisabled();
    expect(screen.getByText('Cobertura de custos fixos')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Salvar composição' })).not.toBeInTheDocument();
    expect(requested.some(({ path }) => path.endsWith('/simulations'))).toBe(false);
  });

  it('labels and warns about the current product price without changing it', async () => {
    const { requested } = setupFetch({
      product: { ...targetProduct, salePrice: '1' },
      initialComposition: { ...composition, profileId: null },
    });
    renderPage();
    expect(await screen.findByText('Análise do preço atual')).toBeVisible();
    expect(screen.getByText('Abaixo do preço mínimo')).toBeVisible();
    expect(
      screen.getByText('O preço é insuficiente para cobrir os custos; há prejuízo estimado.'),
    ).toBeVisible();
    expect(screen.getByText('R$ -1,60')).toBeVisible();
    expect(screen.getByText('-160%')).toBeVisible();
    expect(requested.every(({ method }) => method === 'GET')).toBe(true);
  });

  it('updates component, margin, labor and freight results immediately in the same draft', async () => {
    const user = userEvent.setup();
    setupFetch({ initialComposition: { ...composition, profileId: null } });
    renderPage();
    expect(await screen.findByText('margin-divisor-v1')).toBeVisible();

    const cost = screen.getByLabelText('Custo unitário persistido');
    await user.clear(cost);
    await user.type(cost, '5');
    await waitFor(() => expect(screen.getAllByText('R$ 5,00').length).toBeGreaterThan(0));

    const margin = screen.getByLabelText('Margem desejada (%)');
    await user.clear(margin);
    await user.type(margin, '20');
    await waitFor(() => expect(screen.getByText('20%')).toBeVisible());

    await user.click(screen.getByRole('checkbox', { name: 'Considerar tempo de mão de obra' }));
    await user.type(screen.getByLabelText('Tempo (minutos)'), '60');
    expect(await screen.findByRole('heading', { name: 'Mão de obra' })).toBeVisible();

    await user.selectOptions(screen.getByLabelText('Frete'), 'MANUAL');
    await user.type(screen.getByLabelText('Custo unitário do frete'), '3');
    expect(await screen.findByRole('heading', { name: 'Frete' })).toBeVisible();
    expect(screen.getByText('Cobertura de custos fixos')).toBeVisible();
    expect(screen.getByText('Margem efetiva')).toBeVisible();
    expect(screen.getByText('Classificação')).toBeVisible();
  });

  it('clears the previous result while a newly selected profile detail is loading', async () => {
    const user = userEvent.setup();
    let resolveSecondProfile!: (response: Response) => void;
    const secondProfileResponse = new Promise<Response>((resolve) => {
      resolveSecondProfile = resolve;
    });
    setupFetch({
      profilePages: [[profile, secondProfile]],
      onLinkedProfileGet: (_call, requestedProfileId) => {
        if (requestedProfileId === secondProfileId) return secondProfileResponse;
        return jsonResponse({
          ...profile,
          currentRevision: { ...profile.currentRevision, deductions: [] },
        });
      },
    });
    renderPage();
    expect(await screen.findByText('margin-divisor-v1')).toBeVisible();

    await user.selectOptions(screen.getByLabelText('Perfil de venda'), secondProfileId);
    expect(await screen.findByText('Carregando o perfil selecionado...')).toBeVisible();
    expect(screen.queryByText('margin-divisor-v1')).not.toBeInTheDocument();

    resolveSecondProfile(
      jsonResponse({
        ...secondProfile,
        currentRevision: { ...secondProfile.currentRevision, deductions: [] },
      }),
    );
    expect(await screen.findByText('margin-divisor-v1')).toBeVisible();
  });

  it('shows an explicit configuration-missing state and keeps the draft editable', async () => {
    const user = userEvent.setup();
    const { requested } = setupFetch({
      initialComposition: { ...composition, profileId: null },
      onConfigurationGet: () =>
        jsonResponse(
          {
            statusCode: 404,
            message: 'Configuração não encontrada.',
            code: 'PRICING_CONFIGURATION_NOT_FOUND',
          },
          404,
        ),
    });
    renderPage();
    expect(
      await screen.findByText(
        'Configure os parâmetros organizacionais antes de calcular a prévia.',
      ),
    ).toBeVisible();
    await user.clear(screen.getByLabelText('Custo unitário persistido'));
    await user.type(screen.getByLabelText('Custo unitário persistido'), '4');
    expect(requested.some(({ path }) => path.endsWith('/simulations'))).toBe(false);
    expect(screen.queryByText('margin-divisor-v1')).not.toBeInTheDocument();
  });

  it('calculates a local preview while creating a composition that does not exist yet', async () => {
    setupFetch({ initialComposition: null, profilePages: [[]] });
    renderPage();
    expect(await screen.findByText('margin-divisor-v1')).toBeVisible();
    expect(screen.getAllByText('Nenhum componente informado.')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Criar composição' })).toBeVisible();
  });

  it('recovers from loading error, then preserves a conflict through failed and successful reloads', async () => {
    const user = userEvent.setup();
    setupFetch({
      onPut: () =>
        jsonResponse(
          {
            statusCode: 409,
            message: 'Revisão desatualizada.',
            code: 'PRICING_REVISION_CONFLICT',
            details: { expectedRevision: 2, currentRevision: 3 },
          },
          409,
        ),
      onCompositionGet: (call) => {
        if (call === 1) {
          return jsonResponse(
            { statusCode: 500, message: 'Falha ao carregar.', code: 'INTERNAL_ERROR' },
            500,
          );
        }
        if (call === 2) return jsonResponse(composition);
        if (call === 3) {
          return jsonResponse(
            { statusCode: 500, message: 'Falha interna.', code: 'INTERNAL_ERROR' },
            500,
          );
        }
        return jsonResponse({ ...composition, revision: 3, desiredMargin: '0.3' });
      },
    });
    renderPage();
    expect(await screen.findByText('Falha ao carregar.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    const margin = await screen.findByLabelText('Margem desejada (%)');
    await user.clear(margin);
    await user.type(margin, '26');
    await user.click(screen.getByRole('button', { name: 'Salvar composição' }));
    expect(await screen.findByText(/mudou enquanto você editava/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Recarregar composição' }));
    expect(await screen.findByText('Falha interna.')).toBeVisible();
    expect(margin).toHaveValue('26');
    expect(screen.getByRole('button', { name: 'Salvar composição' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Recarregar composição' }));
    await waitFor(() => expect(margin).toHaveValue('30'));
    expect(screen.queryByText(/mudou enquanto você editava/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar composição' })).toBeEnabled();
  });

  it('creates an initial composition, updates the summary and releases draft protection', async () => {
    const user = userEvent.setup();
    const { requested } = setupFetch({ initialComposition: null });
    renderPage();
    expect(await screen.findByText('Crie a composição persistida deste produto.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Adicionar componente' }));
    await user.type(screen.getByLabelText('Nome'), 'Material novo');
    await user.type(screen.getByLabelText('Custo unitário persistido'), '0002,5000');
    await user.click(screen.getByRole('button', { name: 'Criar composição' }));
    expect(await screen.findByText('Composição inicial criada.')).toBeVisible();
    await waitFor(() => expect(screen.getByText('Composição cadastrada')).toBeVisible());
    const puts = requested.filter(({ method }) => method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0]?.body).toMatchObject({
      expectedRevision: null,
      components: [
        {
          description: 'Material novo',
          quantity: '1',
          costSource: 'MANUAL',
          storedUnitCost: '2.5',
        },
      ],
    });
    const beforeUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(false);
  });

  it('performs a complete ordered replacement and never caches cost for CATALOG', async () => {
    const user = userEvent.setup();
    let putBody: Record<string, unknown> | undefined;
    setupFetch({
      role: 'OPERATIONS',
      catalogPages: [[targetProduct, costlessProduct], [sourceProduct]],
      onPut: (body) => {
        putBody = body;
        return jsonResponse({ ...composition, revision: 3 });
      },
    });
    renderPage();
    expect(await screen.findByLabelText('Nome')).toHaveValue('Embalagem');
    expect(screen.getByRole('button', { name: 'Salvar composição' })).toBeEnabled();
    expect(screen.getByText('Revisão atual:')).toHaveTextContent('2');
    await user.click(screen.getByRole('button', { name: 'Adicionar componente' }));
    const names = screen.getAllByLabelText('Nome');
    await user.type(names[1]!, 'Catálogo');
    const sources = screen.getAllByLabelText('Origem do custo');
    await user.selectOptions(sources[1]!, 'CATALOG');
    expect(screen.queryByRole('option', { name: /Produto alvo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Produto sem custo/ })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Produto do catálogo'), sourceProductId);
    await user.click(screen.getByRole('button', { name: 'Mover componente 2 para cima' }));
    await user.click(screen.getByRole('button', { name: 'Salvar composição' }));
    await waitFor(() => expect(putBody).toBeDefined());
    const sentComponents = putBody?.components as Array<Record<string, unknown>>;
    expect(sentComponents.map(({ description }) => description)).toEqual(['Catálogo', 'Embalagem']);
    expect(sentComponents[0]).toMatchObject({
      costSource: 'CATALOG',
      sourceProductId,
      unit: 'KG',
    });
    expect(sentComponents[0]).not.toHaveProperty('storedUnitCost');
    expect(sentComponents[0]).not.toHaveProperty('position');
  });

  it('identifies an inactive persisted CATALOG source without making it eligible again', async () => {
    const persistedCatalogComposition = {
      ...composition,
      components: [
        {
          ...composition.components[0],
          costSource: 'CATALOG' as const,
          storedUnitCost: null,
          sourceProductId: inactiveSourceProductId,
          unit: 'KG',
        },
      ],
    };
    const { requested } = setupFetch({
      role: 'FINANCE',
      initialComposition: persistedCatalogComposition,
      catalogPages: [[targetProduct, costlessProduct]],
      onProductDetailGet: (detailProductId) =>
        detailProductId === inactiveSourceProductId
          ? jsonResponse(inactiveSourceProduct)
          : undefined,
    });
    renderPage();
    const catalog = await screen.findByLabelText('Produto do catálogo');
    expect(catalog).toHaveDisplayValue('Insumo desativado (KG) — referência atual indisponível');
    expect(
      screen.getByRole('option', {
        name: 'Insumo desativado (KG) — referência atual indisponível',
      }),
    ).toBeDisabled();
    expect(screen.queryByRole('option', { name: /Produto sem custo/ })).not.toBeInTheDocument();
    expect(requested.some(({ path }) => path === `/api/products/${inactiveSourceProductId}`)).toBe(
      true,
    );
  });

  it('resolves a persisted eligible CATALOG source from the second catalog page', async () => {
    const persistedCatalogComposition = {
      ...composition,
      components: [
        {
          ...composition.components[0],
          costSource: 'CATALOG' as const,
          storedUnitCost: null,
          sourceProductId,
          unit: 'KG',
        },
      ],
    };
    const { requested } = setupFetch({
      initialComposition: persistedCatalogComposition,
      catalogPages: [[targetProduct], [sourceProduct]],
    });
    renderPage();
    expect(await screen.findByLabelText('Produto do catálogo')).toHaveDisplayValue(
      'Insumo catálogo (KG)',
    );
    expect(screen.getByRole('option', { name: 'Insumo catálogo (KG)' })).toBeEnabled();
    expect(
      requested.filter(({ path }) => path === '/api/products').map(({ search }) => search),
    ).toEqual(['?isActive=true&page=1&pageSize=100', '?isActive=true&page=2&pageSize=100']);
  });

  it('does not send PUT for a no-op and protects a later draft until cancel', async () => {
    const user = userEvent.setup();
    const { requested } = setupFetch();
    const { router } = renderPage();
    await screen.findByLabelText('Nome');
    await user.click(screen.getByRole('button', { name: 'Salvar composição' }));
    expect(await screen.findByText(/Nenhuma alteração para salvar/)).toBeVisible();
    expect(requested.filter(({ method }) => method === 'PUT')).toHaveLength(0);
    const margin = await screen.findByLabelText('Margem desejada (%)');
    await user.clear(margin);
    await user.type(margin, '27');
    const beforeUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);
    await user.click(screen.getByRole('link', { name: 'Sair da página' }));
    expect(
      await screen.findByRole('heading', { name: 'Descartar alterações não salvas?' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Continuar editando' }));
    expect(router.state.location.pathname).toContain('/precificacao');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    const afterCancel = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(afterCancel);
    expect(afterCancel.defaultPrevented).toBe(false);
    await user.click(screen.getByRole('link', { name: 'Sair da página' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/fora'));
  });
});
