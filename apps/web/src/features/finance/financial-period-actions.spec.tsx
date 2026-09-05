import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { FinancialPeriod } from './finance-api';
import { FinancialPeriodActions } from './financial-period-actions';

const openPeriod: FinancialPeriod = {
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

const closedPeriod: FinancialPeriod = {
  ...openPeriod,
  status: 'CLOSED',
  closedAt: '2026-09-05T17:00:00.000Z',
  updatedAt: '2026-09-05T17:00:00.000Z',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function renderActions(
  period: FinancialPeriod,
  role: 'OWNER' | 'ADMIN' | 'FINANCE' | 'OPERATIONS' | 'VIEWER',
) {
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
      <FinancialPeriodActions period={period} role={role} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FinancialPeriodActions', () => {
  it('should close an open financial period', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (url.endsWith(`/finance/periods/${openPeriod.id}/close`) && init?.method === 'POST') {
          return jsonResponse(closedPeriod);
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderActions(openPeriod, 'FINANCE');

    await user.click(
      screen.getByRole('button', {
        name: 'Fechar competência',
      }),
    );

    expect(screen.getByText('Fechar esta competência?')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Confirmar fechamento',
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `http://localhost:3000/api/finance/periods/${openPeriod.id}/close`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
    });
  });

  it('should allow an owner to reopen a closed period', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (url.endsWith(`/finance/periods/${closedPeriod.id}/reopen`) && init?.method === 'POST') {
          return jsonResponse(openPeriod);
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderActions(closedPeriod, 'OWNER');

    await user.click(
      screen.getByRole('button', {
        name: 'Reabrir competência',
      }),
    );

    expect(screen.getByText('Reabrir esta competência?')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Confirmar reabertura',
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `http://localhost:3000/api/finance/periods/${closedPeriod.id}/reopen`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
    });
  });

  it('should not allow finance role to reopen a closed period', () => {
    renderActions(closedPeriod, 'FINANCE');

    expect(
      screen.queryByRole('button', {
        name: 'Reabrir competência',
      }),
    ).not.toBeInTheDocument();
  });
});
