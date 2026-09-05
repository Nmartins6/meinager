import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { FinancialPeriodForm } from '@/features/finance/financial-period-form';
import type { FinancialPeriod } from '@/features/finance/finance-api';
import { FinancialPage } from './financial-page';

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function renderWithProviders(component: React.ReactNode) {
  const queryClient = createQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{component}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('FinancialPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should display the calculated financial summary', async () => {
    const periodId = '9173bea8-0d7d-45ec-a08d-d1cbac34ceaf';

    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);

      if (url.endsWith('/auth/me')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              user: {
                id: '53a6ba71-77b9-4aca-9493-e08e7dd11b83',
                name: 'Nicolas Martins',
                email: 'nicolas@meinager.local',
              },
              organization: {
                id: '1e091f11-2659-4c7e-a950-f7e09759923d',
                name: 'Meinager Desenvolvimento',
                slug: 'meinager-desenvolvimento',
                role: 'OWNER',
              },
            }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
              },
            },
          ),
        );
      }

      if (url.endsWith('/finance/periods')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: periodId,
                year: 2026,
                month: 9,
                status: 'OPEN',
                revenueSource: 'ENTRIES',
                manualRevenue: null,
                closedAt: null,
                createdAt: '2026-09-01T10:00:00.000Z',
                updatedAt: '2026-09-01T10:00:00.000Z',
              },
            ]),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
              },
            },
          ),
        );
      }

      if (url.endsWith(`/finance/periods/${periodId}/summary`)) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              period: {
                id: periodId,
                year: 2026,
                month: 9,
                status: 'OPEN',
                revenueSource: 'ENTRIES',
                manualRevenue: null,
              },
              totals: {
                revenue: '5000.00',
                fixedExpenses: '1200.00',
                variableExpenses: '800.00',
                contributionMargin: '4200.00',
                result: '3000.00',
                resultStatus: 'POSITIVE',
              },
              entryCounts: {
                revenue: 1,
                fixedExpenses: 1,
                variableExpenses: 1,
                total: 3,
              },
            }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
              },
            },
          ),
        );
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<FinancialPage />);

    expect(await screen.findByRole('heading', { name: 'Financeiro' })).toBeInTheDocument();

    expect(await screen.findAllByText('R$ 5.000,00')).not.toHaveLength(0);

    expect(screen.getAllByText('R$ 3.000,00')).not.toHaveLength(0);

    expect(screen.getByText('Resultado positivo')).toBeInTheDocument();

    expect(screen.getByText('Margem de contribuição')).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000/api/finance/periods/${periodId}/summary`,
      expect.objectContaining({
        credentials: 'include',
      }),
    );
  });

  it('should require manual revenue when that source is selected', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <FinancialPeriodForm periods={[]} onCreated={vi.fn()} onCancel={vi.fn()} />,
    );

    await user.selectOptions(screen.getByLabelText('Origem do faturamento'), 'MANUAL_TOTAL');

    await user.click(screen.getByRole('button', { name: 'Criar competência' }));

    expect(await screen.findByText('Informe o faturamento manual.')).toBeInTheDocument();
  });

  it('should reject a duplicated year and month before calling the API', async () => {
    const user = userEvent.setup();
    const today = new Date();
    const fetchMock = vi.fn();

    const existingPeriod: FinancialPeriod = {
      id: '9173bea8-0d7d-45ec-a08d-d1cbac34ceaf',
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      status: 'OPEN',
      revenueSource: 'ENTRIES',
      manualRevenue: null,
      closedAt: null,
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
    };

    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(
      <FinancialPeriodForm periods={[existingPeriod]} onCreated={vi.fn()} onCancel={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Criar competência' }));

    expect(
      await screen.findByText('Já existe uma competência financeira para este mês.'),
    ).toBeInTheDocument();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
