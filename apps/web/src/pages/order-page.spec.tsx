import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { OrderPage } from './order-page';

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

const pendingStage = {
  id: 'fd2a51d1-744d-465c-8b48-afd8ec2561d0',
  name: 'Pendente',
  position: 1,
  category: 'PENDING',
};

const inProgressStage = {
  id: 'fd2a51d2-744d-465c-8b48-afd8ec2561d0',
  name: 'Em andamento',
  position: 2,
  category: 'IN_PROGRESS',
};

const order = {
  id: 'f25c7c1a-bd29-438f-a940-77d89a93ec50',
  number: 8,
  status: 'PENDING',
  subtotal: '1284.50',
  discount: '50.00',
  total: '1234.50',
  notes: 'Produzir após aprovação.',
  cancelledAt: null,
  createdAt: '2026-09-19T12:00:00.000Z',
  updatedAt: '2026-09-19T12:00:00.000Z',
  workflow: {
    id: 'fd2a51d3-744d-465c-8b48-afd8ec2561d0',
    name: 'Fluxo geral',
  },
  currentStage: pendingStage,
  stageTransitions: [
    {
      id: 'fd2a51d4-744d-465c-8b48-afd8ec2561d0',
      type: 'CREATED',
      createdAt: '2026-09-19T12:00:00.000Z',
      previousStage: null,
      nextStage: pendingStage,
      actor: {
        id: authenticatedUser.user.id,
        name: authenticatedUser.user.name,
      },
    },
  ],
  quote: {
    id: '6a259098-33ef-4464-b9e1-c0fa6bbb082d',
    number: 12,
  },
  client: {
    id: 'd92413f3-bd0c-4086-88f6-6fa45c79c021',
    name: 'Cliente do pedido',
    type: 'COMPANY',
  },
  items: [
    {
      id: 'c932a51d-744d-465c-8b48-afd8ec2561d0',
      productId: '2c83a51d-744d-465c-8b48-afd8ec2561d0',
      position: 1,
      description: 'Caneca branca personalizada',
      unit: 'UN',
      quantity: '2.500000',
      unitPrice: '29.90',
      total: '74.75',
      notes: 'Arte em ambos os lados.',
      createdAt: '2026-09-19T12:00:00.000Z',
      updatedAt: '2026-09-19T12:00:00.000Z',
    },
    {
      id: '3d83a51d-744d-465c-8b48-afd8ec2561d0',
      productId: null,
      position: 2,
      description: 'Criação de arte',
      unit: 'UN',
      quantity: '1.000000',
      unitPrice: '1209.75',
      total: '1209.75',
      notes: null,
      createdAt: '2026-09-19T12:00:00.000Z',
      updatedAt: '2026-09-19T12:00:00.000Z',
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

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/app/financeiro/pedidos/${order.id}`]}>
        <Routes>
          <Route path="/app/financeiro/pedidos" element={<h1>Pedidos</h1>} />
          <Route path="/app/financeiro/pedidos/:orderId" element={<OrderPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OrderPage', () => {
  it('should display an order with its item snapshots and totals', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);

      if (url.endsWith('/auth/me')) {
        return jsonResponse(authenticatedUser);
      }

      if (url.endsWith(`/orders/${order.id}`)) {
        return jsonResponse(order);
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Pedido #8' })).toBeInTheDocument();

    expect(screen.getByText('Cliente do pedido')).toBeInTheDocument();
    expect(screen.getByText('Pendente', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Pedido criado na etapa Pendente.')).toBeInTheDocument();
    expect(screen.getByText('19/09/2026')).toBeInTheDocument();

    expect(screen.getByText('Caneca branca personalizada')).toBeInTheDocument();
    expect(screen.getByText('Criação de arte')).toBeInTheDocument();
    expect(screen.getByText('Arte em ambos os lados.')).toBeInTheDocument();

    expect(screen.getByText('R$ 1.284,50')).toBeInTheDocument();
    expect(screen.getByText('R$ 50,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.234,50')).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000/api/orders/${order.id}`,
      expect.objectContaining({
        credentials: 'include',
      }),
    );
  });

  it('should advance an order and show its generic history', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (url.endsWith('/auth/me')) {
          return jsonResponse(authenticatedUser);
        }

        if (url.endsWith(`/orders/${order.id}/advance`) && init?.method === 'POST') {
          return jsonResponse({
            ...order,
            status: 'IN_PROGRESS',
            currentStage: inProgressStage,
            stageTransitions: [
              ...order.stageTransitions,
              {
                id: 'fd2a51d5-744d-465c-8b48-afd8ec2561d0',
                type: 'ADVANCED',
                createdAt: '2026-09-20T12:00:00.000Z',
                previousStage: pendingStage,
                nextStage: inProgressStage,
                actor: {
                  id: authenticatedUser.user.id,
                  name: authenticatedUser.user.name,
                },
              },
            ],
          });
        }

        if (url.endsWith(`/orders/${order.id}`)) {
          return jsonResponse(order);
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Avançar etapa' }));

    expect(await screen.findByText('Em andamento', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Etapa alterada de Pendente para Em andamento.')).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000/api/orders/${order.id}/advance`,
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );
  });

  it('should hide lifecycle actions from a viewer', async () => {
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

      if (url.endsWith(`/orders/${order.id}`)) {
        return jsonResponse(order);
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(
      await screen.findByText('Você possui acesso somente para consulta deste pedido.'),
    ).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Avançar etapa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).not.toBeInTheDocument();
  });
});
