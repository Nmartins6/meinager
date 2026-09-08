import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { NewProductPage } from './new-product-page';

const authenticatedUser = {
  user: {
    id: '53a6ba71-77b9-4aca-9493-e08e7dd11b83',
    name: 'Nicolas Martins',
    email: 'nicolas@meinager.local',
  },
  organization: {
    id: '9173bea8-0d7d-45ec-a08d-d1cbac34ceaf',
    name: 'Meinager Desenvolvimento',
    slug: 'meinager-desenvolvimento',
    role: 'OWNER',
  },
};

const createdProduct = {
  id: 'f25c7c1a-bd29-438f-a940-77d89a93ec50',
  type: 'PRODUCT',
  name: 'Caneca branca',
  sku: 'CAN-001',
  barcode: null,
  unit: 'UN',
  directCost: '12.500000',
  trackInventory: true,
  minimumStock: '5.000000',
  notes: null,
  isActive: true,
  createdAt: '2026-09-08T12:00:00.000Z',
  updatedAt: '2026-09-08T12:00:00.000Z',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/app/produtos/novo']}>
        <Routes>
          <Route path="/app/produtos/novo" element={<NewProductPage />} />
          <Route path="/app/produtos" element={<h1>Listagem de produtos</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('NewProductPage', () => {
  it('should create a product with inventory tracking', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (url.endsWith('/auth/me')) {
          return jsonResponse(authenticatedUser);
        }

        if (url.endsWith('/products') && init?.method === 'POST') {
          return jsonResponse(createdProduct, 201);
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    await screen.findByLabelText('Nome');

    await user.type(screen.getByLabelText('Nome'), 'Caneca branca');
    await user.type(screen.getByLabelText('SKU opcional'), 'can-001');
    await user.type(screen.getByLabelText('Custo direto opcional'), '12.500000');
    await user.click(screen.getByLabelText(/Controlar estoque deste produto/));
    await user.type(screen.getByLabelText('Estoque mínimo opcional'), '5');

    await user.click(screen.getByRole('button', { name: 'Salvar item' }));

    expect(
      await screen.findByRole('heading', { name: 'Listagem de produtos' }),
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/products',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          type: 'PRODUCT',
          name: 'Caneca branca',
          sku: 'can-001',
          unit: 'UN',
          directCost: '12.500000',
          trackInventory: true,
          minimumStock: '5',
        }),
      }),
    );
  });

  it('should create a service without allowing inventory tracking', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (url.endsWith('/auth/me')) {
          return jsonResponse(authenticatedUser);
        }

        if (url.endsWith('/products') && init?.method === 'POST') {
          return jsonResponse(
            {
              ...createdProduct,
              type: 'SERVICE',
              name: 'Arte para caneca',
              sku: null,
              directCost: null,
              trackInventory: false,
              minimumStock: null,
            },
            201,
          );
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    const typeSelect = await screen.findByLabelText('Tipo');

    await user.selectOptions(typeSelect, 'SERVICE');

    expect(screen.getByLabelText(/Controlar estoque deste produto/)).toBeDisabled();
    expect(screen.getByLabelText('Estoque mínimo opcional')).toBeDisabled();

    await user.type(screen.getByLabelText('Nome'), 'Arte para caneca');
    await user.click(screen.getByRole('button', { name: 'Salvar item' }));

    expect(
      await screen.findByRole('heading', { name: 'Listagem de produtos' }),
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/products',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          type: 'SERVICE',
          name: 'Arte para caneca',
          unit: 'UN',
          trackInventory: false,
        }),
      }),
    );
  });
});
