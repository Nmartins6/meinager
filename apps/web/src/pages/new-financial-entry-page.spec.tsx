import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { NewFinancialEntryPage } from './new-financial-entry-page';

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

const period = {
  id: '03945d2f-507c-4df6-9d99-f620e951ec39',
  year: 2026,
  month: 9,
  status: 'OPEN',
  revenueSource: 'ENTRIES',
  manualRevenue: null,
  closedAt: null,
  createdAt: '2026-09-05T12:00:00.000Z',
  updatedAt: '2026-09-05T12:00:00.000Z',
};

const category = {
  id: '95b5f7b1-cbc5-4eb8-9d8c-e34fd71da87f',
  name: 'Vendas',
  type: 'REVENUE',
  isActive: true,
  createdAt: '2026-09-05T12:00:00.000Z',
  updatedAt: '2026-09-05T12:00:00.000Z',
};

const client = {
  id: '6a259098-33ef-4464-b9e1-c0fa6bbb082d',
  name: 'Cliente E2E',
  type: 'COMPANY',
  document: null,
  phone: null,
  email: null,
  notes: null,
  isActive: true,
  createdAt: '2026-09-05T12:00:00.000Z',
  updatedAt: '2026-09-05T12:00:00.000Z',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('NewFinancialEntryPage', () => {
  it('should create a financial entry and return to the listing', async () => {
    const user = userEvent.setup();

    const createdEntry = {
      id: 'f25c7c1a-bd29-438f-a940-77d89a93ec50',
      description: 'Venda de materiais',
      amount: '1250.50',
      dueDate: '2026-09-10',
      status: 'PENDING',
      origin: 'MANUAL',
      sourceEntryId: null,
      notes: 'Pagamento previsto para setembro.',
      cancelledAt: null,
      createdAt: '2026-09-05T13:00:00.000Z',
      updatedAt: '2026-09-05T13:00:00.000Z',
      period: {
        id: period.id,
        year: period.year,
        month: period.month,
        status: period.status,
      },
      category: {
        id: category.id,
        name: category.name,
        type: category.type,
      },
      client: {
        id: client.id,
        name: client.name,
        type: client.type,
      },
    };

    const fetchMock = vi.fn(
      async (
        input: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response> => {
        const url = String(input);

        if (url.endsWith('/auth/me')) {
          return jsonResponse(authenticatedUser);
        }

        if (url.includes('/finance/periods')) {
          return jsonResponse([period]);
        }

        if (url.includes('/finance/categories')) {
          return jsonResponse([category]);
        }

        if (url.includes('/clients')) {
          return jsonResponse({
            data: [client],
            pagination: {
              page: 1,
              pageSize: 100,
              total: 1,
              totalPages: 1,
            },
          });
        }

        if (
          url.endsWith('/finance/entries') &&
          init?.method === 'POST'
        ) {
          return jsonResponse(createdEntry, 201);
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={['/app/financeiro/lancamentos/novo']}
        >
          <Routes>
            <Route
              path="/app/financeiro/lancamentos/novo"
              element={<NewFinancialEntryPage />}
            />
            <Route
              path="/app/financeiro/lancamentos"
              element={<h1>Listagem de lançamentos</h1>}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const periodSelect = await screen.findByLabelText('Competência');

    await user.selectOptions(periodSelect, period.id);
    await user.selectOptions(
      screen.getByLabelText('Categoria'),
      category.id,
    );
    await user.type(
      screen.getByLabelText('Descrição'),
      'Venda de materiais',
    );
    await user.type(screen.getByLabelText('Valor'), '1250.50');
    await user.type(
      screen.getByLabelText('Data de vencimento'),
      '2026-09-10',
    );
    await user.selectOptions(
      screen.getByLabelText('Cliente opcional'),
      client.id,
    );
    await user.type(
      screen.getByLabelText('Observações'),
      'Pagamento previsto para setembro.',
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Criar lançamento',
      }),
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Listagem de lançamentos',
      }),
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/finance/entries',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          periodId: period.id,
          categoryId: category.id,
          clientId: client.id,
          description: 'Venda de materiais',
          amount: '1250.50',
          dueDate: '2026-09-10',
          notes: 'Pagamento previsto para setembro.',
        }),
      }),
    );
  });
});