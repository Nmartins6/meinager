import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { ProductsPage } from './products-page';

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
  salePrice: '29.90',
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
      <MemoryRouter initialEntries={['/app/produtos']}>
        <ProductsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProductsPage', () => {
  it('should list products and search the catalog', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);

      if (url.endsWith('/auth/me')) {
        return jsonResponse(authenticatedUser);
      }

      if (url.includes('/products')) {
        return jsonResponse({
          data: [product],
          pagination: {
            page: 1,
            pageSize: 10,
            total: 1,
            totalPages: 1,
          },
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByText('Caneca branca')).toBeInTheDocument();
    expect(screen.getByText('R$ 12,50')).toBeInTheDocument();
    expect(screen.getByText('Com controle')).toBeInTheDocument();
    expect(screen.getByText('R$ 29,90')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo produto ou serviço' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Buscar produtos e serviços'), 'Caneca');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/products?search=Caneca&isActive=true&page=1&pageSize=10'),
        expect.objectContaining({
          credentials: 'include',
        }),
      );
    });
  });

  it('should hide creation from a viewer', async () => {
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

      if (url.includes('/products')) {
        return jsonResponse({
          data: [product],
          pagination: {
            page: 1,
            pageSize: 10,
            total: 1,
            totalPages: 1,
          },
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByText('Caneca branca')).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.queryByRole('button', {
          name: 'Novo produto ou serviço',
        }),
      ).not.toBeInTheDocument();
    });
  });
});
