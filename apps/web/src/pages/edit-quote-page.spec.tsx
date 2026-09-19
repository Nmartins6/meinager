import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { EditQuotePage } from './edit-quote-page';

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

const quote = {
  id: 'b24913f3-bd0c-4086-88f6-6fa45c79c021',
  number: 12,
  status: 'DRAFT',
  validUntil: '2026-10-12T00:00:00.000Z',
  subtotal: '74.75',
  discount: '1.20',
  total: '73.55',
  notes: 'Proposta válida para produção sob demanda.',
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
      notes: 'Arte em ambos os lados.',
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
      <MemoryRouter initialEntries={[`/app/financeiro/orcamentos/${quote.id}/editar`]}>
        <Routes>
          <Route path="/app/financeiro/orcamentos/:quoteId/editar" element={<EditQuotePage />} />
          <Route
            path="/app/financeiro/orcamentos/:quoteId"
            element={<h1>Detalhe do orçamento</h1>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('EditQuotePage', () => {
  it('should load a draft quote and save its changes', async () => {
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

        if (url.endsWith(`/quotes/${quote.id}`) && init?.method === 'PATCH') {
          return jsonResponse({
            ...quote,
            subtotal: '89.70',
            total: '88.50',
            updatedAt: '2026-09-13T12:00:00.000Z',
            items: [
              {
                ...quote.items[0],
                quantity: '3',
                total: '89.70',
              },
            ],
          });
        }

        if (url.endsWith(`/quotes/${quote.id}`)) {
          return jsonResponse(quote);
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByLabelText('Cliente')).toHaveValue(client.id);
    expect(screen.getByLabelText('Válido até')).toHaveValue('2026-10-12');
    expect(screen.getByLabelText('Descrição do item 1')).toHaveValue(product.name);
    expect(screen.getByLabelText('Quantidade')).toHaveValue('2.500000');
    expect(screen.getByLabelText('Preço unitário')).toHaveValue('29.90');

    const quantity = screen.getByLabelText('Quantidade');
    await user.clear(quantity);
    await user.type(quantity, '3');

    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(
      await screen.findByRole('heading', { name: 'Detalhe do orçamento' }),
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000/api/quotes/${quote.id}`,
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        body: JSON.stringify({
          clientId: client.id,
          validUntil: '2026-10-12',
          discount: '1.20',
          notes: 'Proposta válida para produção sob demanda.',
          items: [
            {
              productId: product.id,
              description: product.name,
              unit: 'UN',
              quantity: '3',
              unitPrice: '29.90',
              notes: 'Arte em ambos os lados.',
            },
          ],
        }),
      }),
    );
  });

  it('should deny a viewer direct access to quote editing', async () => {
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

      if (url.includes('/clients?')) {
        return jsonResponse(paginatedResponse([client]));
      }

      if (url.includes('/products?')) {
        return jsonResponse(paginatedResponse([product]));
      }

      if (url.endsWith(`/quotes/${quote.id}`)) {
        return jsonResponse(quote);
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(
      await screen.findByText('Você não possui permissão para editar orçamentos.'),
    ).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Salvar alterações' })).not.toBeInTheDocument();
  });
});
