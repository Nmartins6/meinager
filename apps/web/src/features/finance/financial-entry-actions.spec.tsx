import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MemoryRouter,
  useLocation,
} from 'react-router-dom';

import type { FinancialEntry } from './financial-entries-api';
import { FinancialEntryActions } from './financial-entry-actions';

const entry: FinancialEntry = {
  id: 'f25c7c1a-bd29-438f-a940-77d89a93ec50',
  description: 'Aluguel comercial',
  amount: '1500.00',
  dueDate: '2026-09-10',
  status: 'PENDING',
  origin: 'MANUAL',
  sourceEntryId: null,
  notes: null,
  cancelledAt: null,
  createdAt: '2026-09-05T12:00:00.000Z',
  updatedAt: '2026-09-05T12:00:00.000Z',
  period: {
    id: '03945d2f-507c-4df6-9d99-f620e951ec39',
    year: 2026,
    month: 9,
    status: 'OPEN',
  },
  category: {
    id: '95b5f7b1-cbc5-4eb8-9d8c-e34fd71da87f',
    name: 'Aluguel',
    type: 'FIXED_EXPENSE',
  },
  client: null,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function LocationDisplay() {
  const location = useLocation();

  return <p data-testid="current-location">{location.pathname}</p>;
}

function renderActions() {
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
      <MemoryRouter
        initialEntries={[
          `/app/financeiro/lancamentos/${entry.id}`,
        ]}
      >
        <FinancialEntryActions
          entry={entry}
          currentStatus="PENDING"
          settledAmount="0.00"
          canManage
        />
        <LocationDisplay />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FinancialEntryActions', () => {
  it('should validate and cancel a financial entry', async () => {
    const user = userEvent.setup();

    const cancelledEntry: FinancialEntry = {
      ...entry,
      status: 'CANCELLED',
      cancelledAt: '2026-09-05T17:00:00.000Z',
      updatedAt: '2026-09-05T17:00:00.000Z',
    };

    const fetchMock = vi.fn(
      async (
        input: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response> => {
        const url = String(input);

        if (
          url.endsWith(
            `/finance/entries/${entry.id}/cancel`,
          ) &&
          init?.method === 'POST'
        ) {
          return jsonResponse(cancelledEntry);
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderActions();

    await user.click(
      screen.getByRole('button', {
        name: 'Cancelar lançamento',
      }),
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Confirmar cancelamento',
      }),
    );

    expect(
      await screen.findByText(
        'Informe um motivo com pelo menos 3 caracteres.',
      ),
    ).toBeInTheDocument();

    await user.type(
      screen.getByLabelText('Motivo do cancelamento'),
      'Lançamento registrado incorretamente.',
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Confirmar cancelamento',
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `http://localhost:3000/api/finance/entries/${entry.id}/cancel`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({
            reason: 'Lançamento registrado incorretamente.',
          }),
        }),
      );
    });
  });

  it('should duplicate a fixed expense and navigate to it', async () => {
    const user = userEvent.setup();

    const duplicatedEntry: FinancialEntry = {
      ...entry,
      id: 'cb69fead-2f05-48af-b8c7-c8a772653f8d',
      dueDate: '2026-10-10',
      origin: 'DUPLICATED',
      sourceEntryId: entry.id,
      period: {
        id: '5c4216f5-9f3e-4c3b-801f-d1cb87827959',
        year: 2026,
        month: 10,
        status: 'OPEN',
      },
      createdAt: '2026-09-05T18:00:00.000Z',
      updatedAt: '2026-09-05T18:00:00.000Z',
    };

    const fetchMock = vi.fn(
      async (
        input: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response> => {
        const url = String(input);

        if (
          url.endsWith(
            `/finance/entries/${entry.id}/duplicate-next-month`,
          ) &&
          init?.method === 'POST'
        ) {
          return jsonResponse(duplicatedEntry, 201);
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderActions();

    await user.click(
      screen.getByRole('button', {
        name: 'Duplicar para o próximo mês',
      }),
    );

    expect(
      screen.getByText('Duplicar este custo fixo?'),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Confirmar duplicação',
      }),
    );

    expect(
      await screen.findByTestId('current-location'),
    ).toHaveTextContent(
      `/app/financeiro/lancamentos/${duplicatedEntry.id}`,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000/api/finance/entries/${entry.id}/duplicate-next-month`,
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );
  });
});