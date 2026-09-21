import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { OrdersPage } from './orders-page';

const pendingStage = {
  id: 'fd2a51d1-744d-465c-8b48-afd8ec2561d0',
  name: 'Pendente',
  position: 1,
  category: 'PENDING',
};

const completedStage = {
  id: 'fd2a51d2-744d-465c-8b48-afd8ec2561d0',
  name: 'Concluído',
  position: 3,
  category: 'COMPLETED',
};

const order = {
  id: 'f25c7c1a-bd29-438f-a940-77d89a93ec50',
  number: 8,
  status: 'PENDING',
  subtotal: '1284.50',
  discount: '50.00',
  total: '1234.50',
  createdAt: '2026-09-19T12:00:00.000Z',
  updatedAt: '2026-09-19T12:00:00.000Z',
  workflow: {
    id: 'fd2a51d3-744d-465c-8b48-afd8ec2561d0',
    name: 'Fluxo padrão',
  },
  currentStage: pendingStage,
  quote: {
    id: '6a259098-33ef-4464-b9e1-c0fa6bbb082d',
    number: 12,
  },
  client: {
    id: 'd92413f3-bd0c-4086-88f6-6fa45c79c021',
    name: 'Cliente do pedido',
    type: 'COMPANY',
  },
  _count: {
    items: 2,
  },
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function ordersResponse(data = [order]) {
  return {
    data,
    pagination: {
      page: 1,
      pageSize: 10,
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
      <MemoryRouter initialEntries={['/app/financeiro/pedidos']}>
        <Routes>
          <Route path="/app/financeiro/pedidos" element={<OrdersPage />} />
          <Route path="/app/financeiro/pedidos/:orderId" element={<h1>Detalhe do pedido</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OrdersPage', () => {
  it('should list and format orders, then navigate to the detail', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);

      if (url.includes('/orders?')) {
        return jsonResponse(ordersResponse());
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByText('Pedido #8')).toBeInTheDocument();
    expect(screen.getByText('Cliente do pedido')).toBeInTheDocument();
    expect(screen.getByText('Orçamento #12')).toBeInTheDocument();
    expect(screen.getByText('19/09/2026')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.234,50')).toBeInTheDocument();
    expect(screen.getByText('Pendente', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pedido #8' }));

    expect(await screen.findByRole('heading', { name: 'Detalhe do pedido' })).toBeInTheDocument();
  });

  it('should filter orders by status', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);

      if (url.includes('/orders?')) {
        const isCompleted = url.includes('status=COMPLETED');

        return jsonResponse(
          ordersResponse([
            {
              ...order,
              status: isCompleted ? 'COMPLETED' : 'PENDING',
              currentStage: isCompleted ? completedStage : pendingStage,
            },
          ]),
        );
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    await screen.findByText('Pendente', { selector: 'span' });

    await user.selectOptions(screen.getByLabelText('Status'), 'COMPLETED');

    expect(await screen.findByText('Concluído', { selector: 'span' })).toBeInTheDocument();

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes('/orders?status=COMPLETED&page=1&pageSize=10'),
        ),
      ).toBe(true);
    });
  });
});
