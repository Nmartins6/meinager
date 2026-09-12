import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { QuotesPage } from './quotes-page';

const quote = {
  id: 'f25c7c1a-bd29-438f-a940-77d89a93ec50',
  number: 12,
  status: 'DRAFT',
  validUntil: '2026-10-12T00:00:00.000Z',
  subtotal: '1284.50',
  discount: '50.00',
  total: '1234.50',
  createdAt: '2026-09-10T12:00:00.000Z',
  updatedAt: '2026-09-10T12:00:00.000Z',
  client: {
    id: '6a259098-33ef-4464-b9e1-c0fa6bbb082d',
    name: 'Cliente do orçamento',
    type: 'COMPANY',
  },
  _count: {
    items: 2,
  },
};

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

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function quotesResponse(data = [quote]) {
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
      <MemoryRouter initialEntries={['/app/financeiro/orcamentos']}>
        <Routes>
          <Route path="/app/financeiro/orcamentos" element={<QuotesPage />} />
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

describe('QuotesPage', () => {
  it('should list and format quotes without shifting the validity date', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);

      if (url.endsWith('/auth/me')) {
        return jsonResponse(authenticatedUser);
      }

      if (url.includes('/quotes?')) {
        return jsonResponse(quotesResponse());
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByText('Orçamento #12')).toBeInTheDocument();
    expect(screen.getByText('Cliente do orçamento')).toBeInTheDocument();
    expect(screen.getByText('12/10/2026')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.234,50')).toBeInTheDocument();
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should filter quotes by status', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);

      if (url.endsWith('/auth/me')) {
        return jsonResponse(authenticatedUser);
      }

      if (url.includes('/quotes?')) {
        const status = url.includes('status=SENT') ? 'SENT' : 'DRAFT';

        return jsonResponse(
          quotesResponse([
            {
              ...quote,
              status,
            },
          ]),
        );
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    await screen.findByText('Rascunho');

    await user.selectOptions(screen.getByLabelText('Status'), 'SENT');

    expect(await screen.findByText('Enviado')).toBeInTheDocument();

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes('/quotes?status=SENT&page=1&pageSize=10'),
        ),
      ).toBe(true);
    });
  });

  it('should navigate to the selected quote', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);

      if (url.endsWith('/auth/me')) {
        return jsonResponse(authenticatedUser);
      }

      if (url.includes('/quotes?')) {
        return jsonResponse(quotesResponse());
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Orçamento #12' }));

    expect(
      await screen.findByRole('heading', { name: 'Detalhe do orçamento' }),
    ).toBeInTheDocument();
  });
});
