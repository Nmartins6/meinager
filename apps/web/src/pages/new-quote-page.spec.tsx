import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { NewQuotePage } from './new-quote-page';

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

const client = {
  id: '6a259098-33ef-4464-b9e1-c0fa6bbb082d',
  type: 'COMPANY',
  name: 'Cliente do orçamento',
  document: null,
  phone: null,
  email: null,
  notes: null,
  isActive: true,
  createdAt: '2026-09-10T12:00:00.000Z',
  updatedAt: '2026-09-10T12:00:00.000Z',
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
  minimumStock: null,
  notes: null,
  isActive: true,
  createdAt: '2026-09-10T12:00:00.000Z',
  updatedAt: '2026-09-10T12:00:00.000Z',
};

const createdQuote = {
  id: 'b24913f3-bd0c-4086-88f6-6fa45c79c021',
  number: 1,
  status: 'DRAFT',
  validUntil: null,
  subtotal: '74.75',
  discount: '1.20',
  total: '73.55',
  notes: null,
  sentAt: null,
  approvedAt: null,
  rejectedAt: null,
  cancelledAt: null,
  createdAt: '2026-09-10T12:00:00.000Z',
  updatedAt: '2026-09-10T12:00:00.000Z',
  order: null,
  client: {
    id: client.id,
    name: client.name,
    type: client.type,
  },
  items: [
    {
      id: 'c932a51d-744d-465c-8b48-afd8ec2561d0',
      productId: product.id,
      position: 1,
      description: product.name,
      unit: product.unit,
      quantity: '2.500000',
      unitPrice: '29.90',
      total: '74.75',
      notes: null,
      createdAt: '2026-09-10T12:00:00.000Z',
      updatedAt: '2026-09-10T12:00:00.000Z',
    },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function paginatedResponse(data: unknown[]) {
  return {
    data,
    pagination: {
      page: 1,
      pageSize: 100,
      total: data.length,
      totalPages: 1,
    },
  };
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
      <MemoryRouter initialEntries={['/app/financeiro/orcamentos/novo']}>
        <Routes>
          <Route path="/app/financeiro/orcamentos/novo" element={<NewQuotePage />} />
          <Route path="/app/financeiro/orcamentos" element={<h1>Orçamentos</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('NewQuotePage', () => {
  it('should create a quote using a catalog item', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (url.endsWith('/auth/me')) {
          return jsonResponse(authenticatedUser);
        }

        if (url.includes('/clients?')) {
          return jsonResponse(paginatedResponse([client]));
        }

        if (url.includes('/products?')) {
          return jsonResponse(paginatedResponse([product]));
        }

        if (url.endsWith('/quotes') && init?.method === 'POST') {
          return jsonResponse(createdQuote, 201);
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    await user.selectOptions(await screen.findByLabelText('Cliente'), client.id);
    await user.selectOptions(screen.getByLabelText('Item do catálogo opcional'), product.id);

    expect(screen.getByLabelText('Descrição do item 1')).toHaveValue(product.name);
    expect(screen.getByLabelText('Unidade')).toHaveValue('UN');
    expect(screen.getByLabelText('Preço unitário')).toHaveValue('29.90');

    const quantity = screen.getByLabelText('Quantidade');
    await user.clear(quantity);
    await user.type(quantity, '2.5');

    await user.type(screen.getByLabelText('Desconto opcional'), '1.2');

    const summary = screen.getByRole('region', {
      name: 'Resumo do orçamento',
    });

    expect(within(summary).getByText('R$ 74,75')).toBeInTheDocument();
    expect(within(summary).getByText('R$ 1,20')).toBeInTheDocument();
    expect(within(summary).getByText('R$ 73,55')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Salvar orçamento' }));

    expect(await screen.findByRole('heading', { name: 'Orçamentos' })).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/quotes',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          clientId: client.id,
          discount: '1.2',
          items: [
            {
              productId: product.id,
              description: product.name,
              unit: 'UN',
              quantity: '2.5',
              unitPrice: '29.90',
            },
          ],
        }),
      }),
    );
  });

  it('should add an empty item without breaking the quote form', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);

      if (url.endsWith('/auth/me')) {
        return jsonResponse(authenticatedUser);
      }

      if (url.includes('/clients?')) {
        return jsonResponse(paginatedResponse([client]));
      }

      if (url.includes('/products?')) {
        return jsonResponse(paginatedResponse([product]));
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    await screen.findByLabelText('Cliente');

    await user.click(screen.getByRole('button', { name: 'Adicionar item' }));

    expect(screen.getByLabelText('Descrição do item 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Descrição do item 2')).toBeInTheDocument();

    expect(screen.getAllByText('Informe quantidade e preço válidos.')).toHaveLength(2);
  });
});
