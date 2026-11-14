import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GuidedCostEntry } from './guided-cost-entry';

const periodId = 'dd6d490b-3c90-45aa-93f4-061780d15460';
const categoryId = 'b0c8531d-e289-49a2-a68a-5850100944de';

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('GuidedCostEntry', () => {
  it('records a fixed expense in Finance without writing a pricing parameter', async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const dueDate = `${year}-${String(month).padStart(2, '0')}-15`;
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === '/api/finance/periods') {
        return json([
          {
            id: periodId,
            year,
            month,
            status: 'OPEN',
            revenueSource: 'ENTRIES',
            manualRevenue: null,
            closedAt: null,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
        ]);
      }
      if (url.pathname === '/api/finance/categories') {
        return json([
          {
            id: categoryId,
            name: 'Aluguel',
            type: 'FIXED_EXPENSE',
            isActive: true,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
        ]);
      }
      if (url.pathname === '/api/finance/entries' && init?.method === 'POST') {
        return json(
          {
            id: '8058ce86-e2dc-4721-9ede-b4e122ea6f38',
            description: 'Aluguel da loja',
            amount: '500.00',
            dueDate,
            status: 'PENDING',
            origin: 'MANUAL',
            sourceEntryId: null,
            notes: null,
            cancelledAt: null,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            period: { id: periodId, year, month, status: 'OPEN' },
            category: { id: categoryId, name: 'Aluguel', type: 'FIXED_EXPENSE' },
            client: null,
          },
          201,
        );
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <GuidedCostEntry type="FIXED_EXPENSE" />
      </QueryClientProvider>,
    );

    await screen.findByRole('option', { name: 'Aluguel' });
    await user.selectOptions(screen.getByLabelText('Competência'), periodId);
    await user.selectOptions(screen.getByLabelText('Categoria'), categoryId);
    await user.type(screen.getByLabelText('Descrição'), 'Aluguel da loja');
    await user.type(screen.getByLabelText('Valor da despesa'), '500.00');
    fireEvent.change(screen.getByLabelText('Vencimento'), { target: { value: dueDate } });
    await user.click(screen.getByRole('button', { name: 'Registrar despesa' }));

    expect(await screen.findByText(/Despesa registrada/)).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(
      ([url, init]) =>
        new URL(String(url)).pathname === '/api/finance/entries' && init?.method === 'POST',
    );
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      periodId,
      categoryId,
      description: 'Aluguel da loja',
      amount: '500.00',
      dueDate,
    });
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([url]) =>
          new URL(String(url)).pathname.startsWith('/api/pricing'),
        ),
      ).toHaveLength(0),
    );
  });
});
