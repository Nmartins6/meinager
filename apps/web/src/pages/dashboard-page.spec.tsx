import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { DashboardPage } from './dashboard-page';

const organizationId = 'd8d8172c-8912-4649-bf5a-37b9f34d73f8';
const periodId = 'dd6d490b-3c90-45aa-93f4-061780d15460';

function response(body: object) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter([{ path: '/app', element: <DashboardPage /> }], {
    initialEntries: ['/app'],
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DashboardPage', () => {
  it('shows current-period figures and due-date counts from the existing API', async () => {
    const now = new Date();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === '/api/auth/me') {
        return response({
          user: {
            id: '9a3801a9-134d-4e2c-b8cc-bc4c30db9c09',
            name: 'Nicolas',
            email: 'nicolas@example.com',
          },
          organization: {
            id: organizationId,
            name: 'Casa Nacoli',
            slug: 'casa-nacoli',
            role: 'OWNER',
          },
          contextVersion: 1,
        });
      }
      if (url.pathname === '/api/finance/periods') {
        return response([
          {
            id: periodId,
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            status: 'OPEN',
            revenueSource: 'ENTRIES',
            manualRevenue: null,
            closedAt: null,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
        ]);
      }
      if (url.pathname === `/api/finance/periods/${periodId}/summary`) {
        return response({
          period: {
            id: periodId,
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            status: 'OPEN',
            revenueSource: 'ENTRIES',
            manualRevenue: null,
          },
          totals: {
            revenue: '1234.50',
            fixedExpenses: '200.00',
            variableExpenses: '100.00',
            contributionMargin: '1134.50',
            result: '934.50',
            resultStatus: 'POSITIVE',
          },
          entryCounts: { revenue: 1, fixedExpenses: 1, variableExpenses: 1, total: 3 },
        });
      }
      if (url.pathname === '/api/finance/entries') {
        const count = url.searchParams.has('dueFrom') ? 2 : 1;
        return response({
          data: [],
          pagination: { page: 1, pageSize: 1, total: count, totalPages: count },
        });
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderDashboard();

    expect(await screen.findByText('R$ 1.234,50')).toBeInTheDocument();
    expect(screen.getByText('R$ 934,50')).toBeInTheDocument();
    expect(screen.getByText('2', { selector: '.tabular-nums' })).toBeInTheDocument();
    expect(screen.getByText('4', { selector: '.tabular-nums' })).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes('/finance/entries')),
    ).toHaveLength(4);
  });

  it.each(['OPERATIONS', 'VIEWER'] as const)(
    'does not request financial indicators for %s',
    async (role) => {
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname;
        if (path !== '/api/auth/me') throw new Error(`Unexpected request: ${path}`);
        return response({
          user: {
            id: '9a3801a9-134d-4e2c-b8cc-bc4c30db9c09',
            name: 'Carol',
            email: 'carol@example.com',
          },
          organization: { id: organizationId, name: 'Casa Nacoli', slug: 'casa-nacoli', role },
          contextVersion: 1,
        });
      });
      vi.stubGlobal('fetch', fetchMock);
      renderDashboard();

      expect(await screen.findByText(/Olá, Carol/)).toBeInTheDocument();
      expect(screen.queryByText('Indicadores financeiros')).not.toBeInTheDocument();
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    },
  );
});
