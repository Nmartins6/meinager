import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { FinancialEntryPage } from './financial-entry-page';

const entryId = 'f25c7c1a-bd29-438f-a940-77d89a93ec50';
const periodId = '03945d2f-507c-4df6-9d99-f620e951ec39';
const categoryId = '95b5f7b1-cbc5-4eb8-9d8c-e34fd71da87f';
const clientId = '6a259098-33ef-4464-b9e1-c0fa6bbb082d';
const accountId = 'd6614e80-0bd7-498c-a906-2b18c1227a71';

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

const account = {
  id: accountId,
  name: 'Conta principal',
  type: 'CHECKING_ACCOUNT',
  openingBalance: '0.00',
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

describe('FinancialEntryPage', () => {
  it('should display an entry and register a partial settlement', async () => {
    const user = userEvent.setup();

    let currentStatus: 'PENDING' | 'PARTIAL' = 'PENDING';
    let settlements: unknown[] = [];
    let settledAmount = '0.00';
    let remainingAmount = '1250.50';

    function createEntryResponse() {
      return {
        id: entryId,
        description: 'Venda de materiais',
        amount: '1250.50',
        dueDate: '2026-09-10',
        status: currentStatus,
        origin: 'MANUAL',
        sourceEntryId: null,
        notes: 'Pagamento previsto para setembro.',
        cancelledAt: null,
        createdAt: '2026-09-05T13:00:00.000Z',
        updatedAt: '2026-09-05T13:00:00.000Z',
        period: {
          id: periodId,
          year: 2026,
          month: 9,
          status: 'OPEN',
        },
        category: {
          id: categoryId,
          name: 'Vendas',
          type: 'REVENUE',
        },
        client: {
          id: clientId,
          name: 'Cliente E2E',
          type: 'COMPANY',
        },
      };
    }

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (url.endsWith('/auth/me')) {
          return jsonResponse(authenticatedUser);
        }

        if (url.endsWith('/finance/accounts?isActive=true')) {
          return jsonResponse([account]);
        }

        if (url.endsWith(`/finance/entries/${entryId}/settlements`) && init?.method === 'POST') {
          const body = JSON.parse(String(init.body)) as {
            accountId: string;
            amount: string;
            settledAt: string;
            notes?: string;
          };

          currentStatus = 'PARTIAL';
          settledAmount = body.amount;
          remainingAmount = '750.50';

          const settlement = {
            id: '2b103f27-2327-49ca-8914-27e37147332f',
            amount: body.amount,
            settledAt: body.settledAt,
            notes: body.notes ?? null,
            reversedAt: null,
            reversalReason: null,
            createdAt: '2026-09-05T14:00:00.000Z',
            updatedAt: '2026-09-05T14:00:00.000Z',
            account: {
              id: account.id,
              name: account.name,
              type: account.type,
            },
          };

          settlements = [settlement];

          return jsonResponse(
            {
              settlement,
              entry: {
                id: entryId,
                status: currentStatus,
                amount: '1250.50',
                settledAmount,
                remainingAmount,
              },
            },
            201,
          );
        }

        if (url.endsWith(`/finance/entries/${entryId}/settlements`)) {
          return jsonResponse({
            data: settlements,
            entry: {
              id: entryId,
              status: currentStatus,
              amount: '1250.50',
              settledAmount,
              remainingAmount,
            },
          });
        }

        if (url.endsWith(`/finance/entries/${entryId}`)) {
          return jsonResponse(createEntryResponse());
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
        <MemoryRouter initialEntries={[`/app/financeiro/lancamentos/${entryId}`]}>
          <Routes>
            <Route path="/app/financeiro/lancamentos/:entryId" element={<FinancialEntryPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Venda de materiais',
      }),
    ).toBeInTheDocument();

    expect(screen.getByText('Pendente')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 1.250,50').length).toBeGreaterThan(0);

    await user.click(
      screen.getByRole('button', {
        name: 'Registrar baixa',
      }),
    );

    await user.selectOptions(screen.getByLabelText('Conta financeira'), accountId);

    await user.clear(screen.getByLabelText('Valor'));
    await user.type(screen.getByLabelText('Valor'), '500.00');

    await user.clear(screen.getByLabelText('Data da baixa'));
    await user.type(screen.getByLabelText('Data da baixa'), '2026-09-05');

    await user.type(screen.getByLabelText('Observações'), 'Recebimento parcial.');

    await user.click(
      screen.getByRole('button', {
        name: 'Confirmar baixa',
      }),
    );

    expect(await screen.findByText('Parcial')).toBeInTheDocument();
    expect(screen.getByText('R$ 750,50')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 500,00').length).toBeGreaterThan(0);

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000/api/finance/entries/${entryId}/settlements`,
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          accountId,
          amount: '500.00',
          settledAt: '2026-09-05',
          notes: 'Recebimento parcial.',
        }),
      }),
    );
  });
});
