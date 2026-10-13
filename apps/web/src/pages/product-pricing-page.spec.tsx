import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ProductPricingPage } from './product-pricing-page';

const productId = 'f25c7c1a-bd29-438f-a940-77d89a93ec50';

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProductPricingPage', () => {
  it('lets VIEWER read only the commercial summary without internal pricing requests', async () => {
    const requestedPaths: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname;
        requestedPaths.push(path);

        if (path === '/api/auth/me') {
          return jsonResponse({
            user: {
              id: '53a6ba71-77b9-4aca-9493-e08e7dd11b83',
              name: 'Viewer',
              email: 'viewer@meinager.local',
            },
            organization: {
              id: '9173bea8-0d7d-45ec-a08d-d1cbac34ceaf',
              name: 'Meinager',
              slug: 'meinager',
              role: 'VIEWER',
            },
          });
        }

        if (path === `/api/pricing/products/${productId}/summary`) {
          return jsonResponse({
            productId,
            currency: 'BRL',
            salePrice: null,
            priceOrigin: 'MANUAL',
            hasComposition: false,
          });
        }

        throw new Error(`Unexpected request: ${path}`);
      }),
    );

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/app/produtos/${productId}/precificacao`]}>
          <Routes>
            <Route path="/app/produtos/:productId/precificacao" element={<ProductPricingPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Sem preço definido')).toBeInTheDocument();
    expect(screen.queryByText('Composição e análise detalhada')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(requestedPaths).toEqual([
        '/api/auth/me',
        `/api/pricing/products/${productId}/summary`,
      ]);
    });
  });
});
