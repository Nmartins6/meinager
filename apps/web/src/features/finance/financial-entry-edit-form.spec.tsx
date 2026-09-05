import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { FinancialEntry } from './financial-entries-api';
import { FinancialEntryEditForm } from './financial-entry-edit-form';

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

const category = {
  id: entry.category.id,
  name: entry.category.name,
  type: entry.category.type,
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

function renderForm(settledAmount: string) {
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
      <FinancialEntryEditForm entry={entry} settledAmount={settledAmount} canManage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FinancialEntryEditForm', () => {
  it('should update an open financial entry', async () => {
    const user = userEvent.setup();

    const updatedEntry: FinancialEntry = {
      ...entry,
      description: 'Aluguel da loja',
      dueDate: '2026-09-15',
      notes: 'Vencimento atualizado.',
      updatedAt: '2026-09-05T18:00:00.000Z',
    };

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (url.includes('/finance/categories')) {
          return jsonResponse([category]);
        }

        if (url.includes('/clients')) {
          return jsonResponse({
            data: [],
            pagination: {
              page: 1,
              pageSize: 100,
              total: 0,
              totalPages: 0,
            },
          });
        }

        if (url.endsWith(`/finance/entries/${entry.id}`) && init?.method === 'PATCH') {
          return jsonResponse(updatedEntry);
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderForm('0.00');

    await user.click(
      screen.getByRole('button', {
        name: 'Editar lançamento',
      }),
    );

    await user.clear(screen.getByLabelText('Descrição'));
    await user.type(screen.getByLabelText('Descrição'), 'Aluguel da loja');

    await user.clear(screen.getByLabelText('Data de vencimento'));
    await user.type(screen.getByLabelText('Data de vencimento'), '2026-09-15');

    await user.type(screen.getByLabelText('Observações'), 'Vencimento atualizado.');

    await user.click(
      screen.getByRole('button', {
        name: 'Salvar alterações',
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `http://localhost:3000/api/finance/entries/${entry.id}`,
        expect.objectContaining({
          method: 'PATCH',
          credentials: 'include',
          body: JSON.stringify({
            description: 'Aluguel da loja',
            dueDate: '2026-09-15',
            notes: 'Vencimento atualizado.',
          }),
        }),
      );
    });
  });

  it('should protect amount and category when active settlements exist', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);

      if (url.includes('/finance/categories')) {
        return jsonResponse([category]);
      }

      if (url.includes('/clients')) {
        return jsonResponse({
          data: [],
          pagination: {
            page: 1,
            pageSize: 100,
            total: 0,
            totalPages: 0,
          },
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderForm('500.00');

    await user.click(
      screen.getByRole('button', {
        name: 'Editar lançamento',
      }),
    );

    expect(screen.getByLabelText('Categoria')).toBeDisabled();
    expect(screen.getByLabelText('Valor')).toHaveAttribute('readonly');

    expect(
      screen.getByText('A categoria não pode ser alterada enquanto houver baixas ativas.'),
    ).toBeInTheDocument();

    expect(
      screen.getByText('O valor não pode ser alterado enquanto houver baixas ativas.'),
    ).toBeInTheDocument();
  });
});
