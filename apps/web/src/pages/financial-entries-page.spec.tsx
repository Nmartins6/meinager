import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { FinancialEntriesPage } from './financial-entries-page';

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

const entry = {
  id: 'f25c7c1a-bd29-438f-a940-77d89a93ec50',
  description: 'Venda de materiais',
  amount: '1250.50',
  dueDate: '2026-09-10',
  status: 'PENDING',
  origin: 'MANUAL',
  sourceEntryId: null,
  notes: null,
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
    id: '95b5f7b1-cbc5-4eb8-9d8c-e34fd71da87f',
    name: 'Vendas',
    type: 'REVENUE',
  },
  client: {
    id: '6a259098-33ef-4464-b9e1-c0fa6bbb082d',
    name: 'Cliente E2E',
    type: 'COMPANY',
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
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/app/financeiro/lancamentos']}>
        <FinancialEntriesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FinancialEntriesPage', () => {
  it('should list and format financial entries', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);

      if (url.endsWith('/auth/me')) {
        return jsonResponse(authenticatedUser);
      }

      if (url.includes('/finance/periods')) {
        return jsonResponse([period]);
      }

      if (url.includes('/finance/entries')) {
        return jsonResponse({
          data: [entry],
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

    expect(await screen.findByText('Venda de materiais')).toBeInTheDocument();

    expect(screen.getByText('+R$ 1.250,50')).toBeInTheDocument();
    expect(screen.getByText('10/09/2026')).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    expect(screen.getByText('Cliente E2E')).toBeInTheDocument();
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

      if (url.includes('/finance/periods')) {
        return jsonResponse([period]);
      }

      if (url.includes('/finance/entries')) {
        return jsonResponse({
          data: [entry],
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

    expect(await screen.findByText('Venda de materiais')).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Novo lançamento',
      }),
    ).not.toBeInTheDocument();
  });
});
