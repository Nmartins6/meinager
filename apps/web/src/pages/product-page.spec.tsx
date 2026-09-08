import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ProductPage } from './product-page';

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

const product = {
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
      <MemoryRouter initialEntries={[`/app/produtos/${product.id}`]}>
        <Routes>
          <Route path="/app/produtos/:productId" element={<ProductPage />} />
          <Route path="/app/produtos" element={<h1>Listagem de produtos</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProductPage', () => {
  it('should update a product and return to the listing', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (url.endsWith('/auth/me')) {
          return jsonResponse(authenticatedUser);
        }

        if (url.endsWith(`/products/${product.id}`) && init?.method === 'PATCH') {
          return jsonResponse({
            ...product,
            directCost: '13.000000',
          });
        }

        if (url.endsWith(`/products/${product.id}`)) {
          return jsonResponse(product);
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    const directCost = await screen.findByLabelText('Custo direto opcional');

    await user.clear(directCost);
    await user.type(directCost, '13');

    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(
      await screen.findByRole('heading', { name: 'Listagem de produtos' }),
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000/api/products/${product.id}`,
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        body: JSON.stringify({
          type: 'PRODUCT',
          name: 'Caneca branca',
          sku: 'CAN-001',
          barcode: null,
          unit: 'UN',
          directCost: '13',
          trackInventory: true,
          minimumStock: '5.000000',
          notes: null,
        }),
      }),
    );
  });

  it('should deactivate a product without leaving the page', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (url.endsWith('/auth/me')) {
          return jsonResponse(authenticatedUser);
        }

        if (url.endsWith(`/products/${product.id}`) && init?.method === 'PATCH') {
          return jsonResponse({
            ...product,
            isActive: false,
          });
        }

        if (url.endsWith(`/products/${product.id}`)) {
          return jsonResponse(product);
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Inativar item' }));

    expect(await screen.findByRole('button', { name: 'Reativar item' })).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000/api/products/${product.id}`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          isActive: false,
        }),
      }),
    );
  });

  it('should hide editing actions from a viewer', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);

      if (url.endsWith('/auth/me')) {
        return jsonResponse({
          ...authenticatedUser,
          organization: {
            ...authenticatedUser.organization,
            role: 'VIEWER',
          },
        });
      }

      if (url.endsWith(`/products/${product.id}`)) {
        return jsonResponse(product);
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(
      await screen.findByText('Você não possui permissão para editar este item.'),
    ).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Salvar alterações' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inativar item' })).not.toBeInTheDocument();
  });
});
