import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { QuotePage } from './quote-page';

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

const quote = {
  id: 'f25c7c1a-bd29-438f-a940-77d89a93ec50',
  number: 12,
  status: 'DRAFT',
  validUntil: '2026-10-12T00:00:00.000Z',
  subtotal: '1284.50',
  discount: '50.00',
  total: '1234.50',
  notes: 'Proposta válida para produção sob demanda.',
  sentAt: null,
  approvedAt: null,
  rejectedAt: null,
  cancelledAt: null,
  createdAt: '2026-09-10T12:00:00.000Z',
  updatedAt: '2026-09-10T12:00:00.000Z',
  order: null,
  client: {
    id: '6a259098-33ef-4464-b9e1-c0fa6bbb082d',
    name: 'Cliente do orçamento',
    type: 'COMPANY',
  },
  items: [
    {
      id: 'c932a51d-744d-465c-8b48-afd8ec2561d0',
      productId: 'd92413f3-bd0c-4086-88f6-6fa45c79c021',
      position: 1,
      description: 'Caneca branca personalizada',
      unit: 'UN',
      quantity: '2.500000',
      unitPrice: '29.90',
      total: '74.75',
      notes: 'Arte em ambos os lados.',
      createdAt: '2026-09-10T12:00:00.000Z',
      updatedAt: '2026-09-10T12:00:00.000Z',
    },
    {
      id: '2c83a51d-744d-465c-8b48-afd8ec2561d0',
      productId: null,
      position: 2,
      description: 'Criação de arte',
      unit: 'UN',
      quantity: '1.000000',
      unitPrice: '1209.75',
      total: '1209.75',
      notes: null,
      createdAt: '2026-09-10T12:00:00.000Z',
      updatedAt: '2026-09-10T12:00:00.000Z',
    },
  ],
};

const createdOrderStage = {
  id: 'b24913f1-bd0c-4086-88f6-6fa45c79c021',
  name: 'Pendente',
  position: 1,
  category: 'PENDING',
};

const createdOrder = {
  id: 'b24913f3-bd0c-4086-88f6-6fa45c79c021',
  number: 1,
  status: 'PENDING',
  subtotal: quote.subtotal,
  discount: quote.discount,
  total: quote.total,
  notes: quote.notes,
  cancelledAt: null,
  createdAt: '2026-09-19T12:00:00.000Z',
  updatedAt: '2026-09-19T12:00:00.000Z',
  workflow: {
    id: 'b24913f2-bd0c-4086-88f6-6fa45c79c021',
    name: 'Fluxo geral',
  },
  currentStage: createdOrderStage,
  stageTransitions: [
    {
      id: 'b24913f3-bd0c-4086-88f6-6fa45c79c021',
      type: 'CREATED',
      createdAt: '2026-09-19T12:00:00.000Z',
      previousStage: null,
      nextStage: createdOrderStage,
      actor: {
        id: authenticatedUser.user.id,
        name: authenticatedUser.user.name,
      },
    },
  ],
  quote: {
    id: quote.id,
    number: quote.number,
  },
  client: quote.client,
  items: quote.items,
};

const defaultOrderWorkflow = {
  id: '4f6f5b6a-8f7a-4d62-9b87-21b6bf8be001',
  name: 'Fluxo geral',
  isDefault: true,
  isActive: true,
  createdAt: '2026-09-19T12:00:00.000Z',
  updatedAt: '2026-09-19T12:00:00.000Z',
  stages: [
    {
      id: '4f6f5b6a-8f7a-4d62-9b87-21b6bf8be011',
      name: 'Pendente',
      position: 1,
      category: 'PENDING',
      isActive: true,
    },
    {
      id: '4f6f5b6a-8f7a-4d62-9b87-21b6bf8be012',
      name: 'Em andamento',
      position: 2,
      category: 'IN_PROGRESS',
      isActive: true,
    },
    {
      id: '4f6f5b6a-8f7a-4d62-9b87-21b6bf8be013',
      name: 'Concluído',
      position: 3,
      category: 'COMPLETED',
      isActive: true,
    },
  ],
  _count: {
    orders: 3,
  },
};

const serviceOrderWorkflow = {
  id: '5a7e3c21-62df-47d8-a93e-1ed4c0ad1001',
  name: 'Prestação de serviços',
  isDefault: false,
  isActive: true,
  createdAt: '2026-09-20T12:00:00.000Z',
  updatedAt: '2026-09-20T12:00:00.000Z',
  stages: [
    {
      id: '5a7e3c21-62df-47d8-a93e-1ed4c0ad1011',
      name: 'Solicitação recebida',
      position: 1,
      category: 'PENDING',
      isActive: true,
    },
    {
      id: '5a7e3c21-62df-47d8-a93e-1ed4c0ad1012',
      name: 'Executando serviço',
      position: 2,
      category: 'IN_PROGRESS',
      isActive: true,
    },
    {
      id: '5a7e3c21-62df-47d8-a93e-1ed4c0ad1013',
      name: 'Serviço finalizado',
      position: 3,
      category: 'COMPLETED',
      isActive: true,
    },
  ],
  _count: {
    orders: 0,
  },
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
      <MemoryRouter initialEntries={[`/app/financeiro/orcamentos/${quote.id}`]}>
        <Routes>
          <Route path="/app/financeiro/orcamentos/:quoteId" element={<QuotePage />} />
          <Route path="/app/financeiro/orcamentos" element={<h1>Orçamentos</h1>} />
          <Route path="/app/financeiro/pedidos/:orderId" element={<h1>Detalhe do pedido</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('QuotePage', () => {
  it('should display a quote with its item snapshots and totals', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);

      if (url.endsWith('/auth/me')) {
        return jsonResponse(authenticatedUser);
      }

      if (url.endsWith(`/quotes/${quote.id}`)) {
        return jsonResponse(quote);
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Orçamento #12' })).toBeInTheDocument();

    expect(screen.getByText('Cliente do orçamento')).toBeInTheDocument();
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByText('12/10/2026')).toBeInTheDocument();

    expect(screen.getByText('Caneca branca personalizada')).toBeInTheDocument();
    expect(screen.getByText('Criação de arte')).toBeInTheDocument();
    expect(screen.getByText('Arte em ambos os lados.')).toBeInTheDocument();

    expect(screen.getByText('R$ 1.284,50')).toBeInTheDocument();
    expect(screen.getByText('R$ 50,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.234,50')).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000/api/quotes/${quote.id}`,
      expect.objectContaining({
        credentials: 'include',
      }),
    );
  });

  it('should send a draft quote and show its next available actions', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (url.endsWith('/auth/me')) {
          return jsonResponse(authenticatedUser);
        }

        if (url.endsWith(`/quotes/${quote.id}/send`) && init?.method === 'POST') {
          return jsonResponse({
            ...quote,
            status: 'SENT',
            sentAt: '2026-09-12T12:00:00.000Z',
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

    await user.click(await screen.findByRole('button', { name: 'Enviar orçamento' }));

    expect(await screen.findByText('Enviado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aprovar orçamento' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recusar orçamento' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar orçamento' })).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000/api/quotes/${quote.id}/send`,
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

      if (url.endsWith(`/quotes/${quote.id}`)) {
        return jsonResponse({
          ...quote,
          status: 'APPROVED',
          approvedAt: '2026-09-19T12:00:00.000Z',
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(
      await screen.findByText('Você possui acesso somente para consulta deste orçamento.'),
    ).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Enviar orçamento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar orçamento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Criar pedido' })).not.toBeInTheDocument();
  });

  it('should convert an approved quote using the selected workflow', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (url.endsWith('/auth/me')) {
          return jsonResponse(authenticatedUser);
        }

        if (url.endsWith('/order-workflows/active')) {
          return jsonResponse([defaultOrderWorkflow, serviceOrderWorkflow]);
        }

        if (url.endsWith('/orders') && init?.method === 'POST') {
          return jsonResponse(createdOrder, 201);
        }

        if (url.endsWith(`/quotes/${quote.id}`)) {
          return jsonResponse({
            ...quote,
            status: 'APPROVED',
            approvedAt: '2026-09-19T12:00:00.000Z',
          });
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    const workflowSelect = await screen.findByRole('combobox', {
      name: 'Fluxo do pedido',
    });

    await waitFor(() => {
      expect(workflowSelect).toHaveValue(defaultOrderWorkflow.id);
    });

    expect(screen.getByText(/Pendente → Em andamento → Concluído/)).toBeInTheDocument();

    await user.selectOptions(workflowSelect, serviceOrderWorkflow.id);

    expect(workflowSelect).toHaveValue(serviceOrderWorkflow.id);
    expect(
      screen.getByText(/Solicitação recebida → Executando serviço → Serviço finalizado/),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Criar pedido',
      }),
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Detalhe do pedido',
      }),
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/orders',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          quoteId: quote.id,
          workflowId: serviceOrderWorkflow.id,
        }),
      }),
    );
  });

  it('should disable order creation when no active workflow is available', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);

      if (url.endsWith('/auth/me')) {
        return jsonResponse(authenticatedUser);
      }

      if (url.endsWith('/order-workflows/active')) {
        return jsonResponse([]);
      }

      if (url.endsWith(`/quotes/${quote.id}`)) {
        return jsonResponse({
          ...quote,
          status: 'APPROVED',
          approvedAt: '2026-09-19T12:00:00.000Z',
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(
      await screen.findByText('Nenhum fluxo ativo está disponível para criar o pedido.'),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: 'Criar pedido',
      }),
    ).toBeDisabled();

    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/orders'))).toBe(false);
  });

  it('should open a linked order instead of offering another creation', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);

      if (url.endsWith('/auth/me')) {
        return jsonResponse(authenticatedUser);
      }

      if (url.endsWith(`/quotes/${quote.id}`)) {
        return jsonResponse({
          ...quote,
          status: 'APPROVED',
          approvedAt: '2026-09-19T12:00:00.000Z',
          order: {
            id: createdOrder.id,
            number: createdOrder.number,
            status: 'IN_PROGRESS',
          },
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByText('Pedido #1')).toBeInTheDocument();
    expect(screen.getByText(/Situação geral: Em andamento\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Criar pedido' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Abrir pedido #1' }));

    expect(await screen.findByRole('heading', { name: 'Detalhe do pedido' })).toBeInTheDocument();
  });
});
