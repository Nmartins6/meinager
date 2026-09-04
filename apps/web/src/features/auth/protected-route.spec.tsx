import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from './protected-route';

function renderProtectedRoute() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <h1>Área protegida</h1>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<h1>Tela de login</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProtectedRoute', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should render protected content for an authenticated session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
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
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      ),
    );

    renderProtectedRoute();

    expect(await screen.findByRole('heading', { name: 'Área protegida' })).toBeInTheDocument();
  });

  it('should redirect an unauthenticated request to login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            message: 'Sessão inválida ou expirada.',
          }),
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      ),
    );

    renderProtectedRoute();

    expect(await screen.findByRole('heading', { name: 'Tela de login' })).toBeInTheDocument();

    expect(screen.queryByRole('heading', { name: 'Área protegida' })).not.toBeInTheDocument();
  });
});
