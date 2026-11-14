import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { GuidedSetupPage } from './guided-setup-page';

const organizationId = 'd8d8172c-8912-4649-bf5a-37b9f34d73f8';
const productId = 'cc63ebc1-dcf5-4e92-8dc6-a01359e3bf44';

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function auth(role: 'OWNER' | 'VIEWER') {
  return {
    user: {
      id: '9a3801a9-134d-4e2c-b8cc-bc4c30db9c09',
      name: 'Nicolas',
      email: 'nicolas@example.com',
    },
    organization: { id: organizationId, name: 'Casa Nacoli', slug: 'casa-nacoli', role },
    contextVersion: 1,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: '/app/cadastro-guiado', element: <GuidedSetupPage /> }],
    { initialEntries: ['/app/cadastro-guiado'] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('GuidedSetupPage', () => {
  it('does not load internal pricing or finance data for VIEWER', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (path !== '/api/auth/me') throw new Error(`Unexpected request: ${path}`);
      return json(auth('VIEWER'));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderPage();

    expect(await screen.findByText(/disponível para administradores/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('requires a unit cost for a catalog input and never sends a sale price for it', async () => {
    const user = userEvent.setup();
    const now = new Date();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === '/api/auth/me') return json(auth('OWNER'));
      if (url.pathname === '/api/finance/periods') return json([]);
      if (url.pathname === '/api/finance/categories') return json([]);
      if (url.pathname === '/api/pricing/configuration') {
        return json(
          { statusCode: 404, code: 'PRICING_CONFIGURATION_NOT_FOUND', message: 'Não encontrada.' },
          404,
        );
      }
      if (url.pathname === '/api/pricing/profiles') {
        return json({ data: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 } });
      }
      if (url.pathname === '/api/products' && init?.method === 'POST') {
        return json(
          {
            id: productId,
            type: 'PRODUCT',
            name: 'Caneca branca',
            sku: null,
            barcode: null,
            unit: 'UN',
            directCost: '8.50',
            salePrice: null,
            trackInventory: false,
            minimumStock: null,
            notes: null,
            isActive: true,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
          201,
        );
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderPage();

    await screen.findByRole('heading', { name: 'Cadastre e forme seu preço' });
    const supplies = document.getElementById('insumos');
    expect(supplies).not.toBeNull();
    const supplySection = within(supplies!);
    await user.type(supplySection.getByLabelText('Nome'), 'Caneca branca');
    await user.click(supplySection.getByRole('button', { name: 'Cadastrar insumo' }));

    expect(
      await supplySection.findByText(/Informe o custo por unidade de consumo/),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(
        ([url, init]) =>
          new URL(String(url)).pathname === '/api/products' && init?.method === 'POST',
      ),
    ).toHaveLength(0);

    await user.type(supplySection.getByLabelText('Custo por unidade de consumo'), '8.50');
    await user.click(supplySection.getByRole('button', { name: 'Cadastrar insumo' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(
          ([url, init]) =>
            new URL(String(url)).pathname === '/api/products' && init?.method === 'POST',
        ),
      ).toHaveLength(1),
    );
    const productPost = fetchMock.mock.calls.find(
      ([url, init]) => new URL(String(url)).pathname === '/api/products' && init?.method === 'POST',
    );
    const payload = JSON.parse(String(productPost?.[1]?.body));
    expect(payload).toMatchObject({ name: 'Caneca branca', directCost: '8.50', unit: 'UN' });
    expect(payload).not.toHaveProperty('salePrice');
  });
});
