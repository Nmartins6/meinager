import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';

import type { OrganizationRole } from '@/features/pricing/pricing-permissions';

import { PricingProfilePage } from './pricing-profile-page';
import { PricingProfilesPage } from './pricing-profiles-page';

const profileId = '11111111-1111-4111-8111-111111111111';
const userId = '44444444-4444-4444-8444-444444444444';

function auth(role: OrganizationRole) {
  return {
    user: { id: userId, name: 'Nicolas', email: 'nicolas@example.com' },
    organization: {
      id: '9173bea8-0d7d-45ec-a08d-d1cbac34ceaf',
      name: 'Meinager',
      slug: 'meinager',
      role,
    },
  };
}

function profile(revision = 2, overrides: Record<string, unknown> = {}) {
  return {
    id: profileId,
    isActive: true,
    createdAt: '2026-10-18T12:00:00.000Z',
    updatedAt: '2026-10-18T12:00:00.000Z',
    currentRevision: {
      id: '22222222-2222-4222-8222-222222222222',
      revision,
      name: 'Varejo',
      effectiveFrom: '2026-10-18T12:00:00.000Z',
      createdAt: '2026-10-18T12:00:00.000Z',
      deductions: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          position: 1,
          name: 'Cartão',
          category: 'CARD',
          rate: '0.0315',
          origin: 'MANUAL',
          originDetails: {
            schemaVersion: 1,
            source: 'Contrato',
            referenceId: null,
            periodStart: null,
            periodEnd: null,
            criterion: null,
            measuredAt: null,
            confirmedByUserId: userId,
          },
          createdAt: '2026-10-18T12:00:00.000Z',
        },
      ],
    },
    ...overrides,
  };
}

function item() {
  const value = profile();
  const { deductions: _deductions, ...currentRevision } = value.currentRevision;
  return { ...value, currentRevision };
}

function list(data = [item()], page = 1, totalPages = 1) {
  return { data, pagination: { page, pageSize: 20, total: data.length, totalPages } };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function pricingError(status: number, code: string, message: string) {
  return jsonResponse({ statusCode: status, code, message }, status);
}

function renderRoutes(initialEntry = '/app/produtos/precificacao/perfis') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      {
        path: '/app/produtos/precificacao/perfis',
        element: (
          <>
            <Link to="/app/produtos">Sair dos perfis</Link>
            <PricingProfilesPage />
          </>
        ),
      },
      {
        path: '/app/produtos/precificacao/perfis/:profileId',
        element: <PricingProfilePage />,
      },
      { path: '/app/produtos', element: <h1>Catálogo de produtos</h1> },
    ],
    { initialEntries: [initialEntry] },
  );
  return {
    router,
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('pricing profiles pages', () => {
  it('does not query or expose profile data to VIEWER', async () => {
    const requested: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname;
        requested.push(path);
        if (path === '/api/auth/me') return jsonResponse(auth('VIEWER'));
        throw new Error(`Unexpected request: ${path}`);
      }),
    );
    renderRoutes();
    expect(await screen.findByRole('alert')).toHaveTextContent('não estão disponíveis');
    expect(requested).toEqual(['/api/auth/me']);
  });

  it('does not query a directly addressed profile for VIEWER', async () => {
    const requested: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname;
        requested.push(path);
        if (path === '/api/auth/me') return jsonResponse(auth('VIEWER'));
        throw new Error(`Unexpected request: ${path}`);
      }),
    );
    renderRoutes(`/app/produtos/precificacao/perfis/${profileId}`);
    expect(await screen.findByRole('alert')).toHaveTextContent('não estão disponíveis');
    expect(requested).toEqual(['/api/auth/me']);
  });

  it.each(['OPERATIONS', 'FINANCE'] as const)('shows profiles read-only to %s', async (role) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname;
        if (path === '/api/auth/me') return jsonResponse(auth(role));
        if (path === `/api/pricing/profiles/${profileId}`) return jsonResponse(profile());
        return jsonResponse(list());
      }),
    );
    renderRoutes(`/app/produtos/precificacao/perfis/${profileId}`);
    expect(await screen.findByDisplayValue('Varejo')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Salvar perfil' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desativar perfil' })).not.toBeInTheDocument();
  });

  it('shows loading, error with retry, empty state and status-specific query keys', async () => {
    const user = userEvent.setup();
    let calls = 0;
    const urls: string[] = [];
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        if (url.pathname === '/api/auth/me') return jsonResponse(auth('OWNER'));
        urls.push(url.toString());
        calls += 1;
        if (calls === 1) {
          await pending;
          return pricingError(500, 'INTERNAL_ERROR', 'Falha temporária.');
        }
        return jsonResponse(list([]));
      }),
    );
    renderRoutes();
    expect(await screen.findByText('Carregando perfis...')).toBeInTheDocument();
    release?.();
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha temporária.');
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Nenhum perfil encontrado')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Estado'), 'inactive');
    await waitFor(() => expect(urls.some((url) => url.includes('isActive=false'))).toBe(true));
    expect(urls.some((url) => url.includes('page=1') && url.includes('pageSize=20'))).toBe(true);
  });

  it('requests the next page without mixing it with the current page', async () => {
    const user = userEvent.setup();
    const pages: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        if (url.pathname === '/api/auth/me') return jsonResponse(auth('OWNER'));
        const page = url.searchParams.get('page') ?? '1';
        pages.push(page);
        return jsonResponse(list([item()], Number(page), 2));
      }),
    );
    renderRoutes();
    await user.click(await screen.findByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(pages).toEqual(['1', '2']));
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
  });

  it('creates an ordered deduction with an exact canonical percentage and no protected fields', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path === '/api/auth/me') return jsonResponse(auth('ADMIN'));
      if (path === '/api/pricing/profiles' && init?.method === 'POST') {
        bodies.push(JSON.parse(String(init.body)));
        return jsonResponse(profile(1));
      }
      if (path === `/api/pricing/profiles/${profileId}`) return jsonResponse(profile(1));
      return jsonResponse(list([]));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { router } = renderRoutes();
    await user.click(await screen.findByRole('button', { name: 'Criar perfil' }));
    await user.type(screen.getByLabelText('Nome'), 'Varejo');
    await user.click(screen.getByRole('button', { name: 'Adicionar dedução' }));
    await user.type(screen.getByLabelText('Nome', { selector: '#deduction-0-name' }), 'Cartão');
    await user.type(screen.getByLabelText('Categoria'), 'CARD');
    await user.type(screen.getByLabelText('Percentual'), '3,150000');
    await user.click(screen.getByRole('button', { name: 'Criar perfil' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(router.state.location.pathname).toBe(`/app/produtos/precificacao/perfis/${profileId}`);
    expect(await screen.findByRole('heading', { name: 'Varejo' })).toBeInTheDocument();
    expect(screen.queryByText('Descartar alterações não salvas?')).not.toBeInTheDocument();
    const beforeUnload = new Event('beforeunload', { cancelable: true });
    expect(window.dispatchEvent(beforeUnload)).toBe(true);
    expect(beforeUnload.defaultPrevented).toBe(false);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    expect(bodies[0]).toEqual({
      name: 'Varejo',
      deductions: [
        {
          name: 'Cartão',
          category: 'CARD',
          rate: '0.0315',
          origin: 'MANUAL',
          originDetails: {
            source: null,
            referenceId: null,
            periodStart: null,
            periodEnd: null,
            criterion: null,
            measuredAt: null,
          },
        },
      ],
    });
    expect(JSON.stringify(bodies[0])).not.toMatch(
      /position|schemaVersion|confirmedByUserId|organizationId/,
    );
  });

  it('focuses the first invalid field and does not issue a request', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      return path === '/api/auth/me' ? jsonResponse(auth('OWNER')) : jsonResponse(list([]));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderRoutes();
    await user.click(await screen.findByRole('button', { name: 'Criar perfil' }));
    await user.click(screen.getByRole('button', { name: 'Criar perfil' }));
    expect(await screen.findByText('Informe o nome do perfil.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveFocus();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
  });

  it('sends a name-only patch and handles a semantic no-op without PATCH', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        if (path === '/api/auth/me') return jsonResponse(auth('OWNER'));
        if (init?.method === 'PATCH') {
          bodies.push(JSON.parse(String(init.body)));
          return jsonResponse(
            profile(3, { currentRevision: { ...profile(3).currentRevision, name: 'Atacado' } }),
          );
        }
        return jsonResponse(profile());
      }),
    );
    renderRoutes(`/app/produtos/precificacao/perfis/${profileId}`);
    const name = await screen.findByLabelText('Nome', { selector: '#profile-name' });
    await user.clear(name);
    await user.type(name, 'Atacado');
    await user.click(screen.getByRole('button', { name: 'Salvar perfil' }));
    await waitFor(() => expect(bodies).toEqual([{ expectedRevision: 2, name: 'Atacado' }]));
    await user.click(screen.getByRole('button', { name: 'Salvar perfil' }));
    expect(await screen.findByText(/Nenhuma alteração para salvar/)).toBeInTheDocument();
    expect(bodies).toHaveLength(1);
  });

  it('preserves a conflicted draft through failed reload and resolves it only after a successful GET', async () => {
    const user = userEvent.setup();
    let gets = 0;
    let patches = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        if (path === '/api/auth/me') return jsonResponse(auth('OWNER'));
        if (init?.method === 'PATCH') {
          patches += 1;
          return pricingError(409, 'PRICING_REVISION_CONFLICT', 'Revisão alterada.');
        }
        if (path === `/api/pricing/profiles/${profileId}`) {
          gets += 1;
          if (gets === 2) return pricingError(500, 'INTERNAL_ERROR', 'Falha ao recarregar.');
          return jsonResponse(gets >= 3 ? profile(3) : profile());
        }
        throw new Error(`Unexpected request: ${path}`);
      }),
    );
    renderRoutes(`/app/produtos/precificacao/perfis/${profileId}`);
    const name = await screen.findByLabelText('Nome', { selector: '#profile-name' });
    await user.clear(name);
    await user.type(name, 'Rascunho');
    await user.click(screen.getByRole('button', { name: 'Salvar perfil' }));
    expect(await screen.findByText(/rascunho foi preservado/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Recarregar perfil' }));
    expect(await screen.findByText('Falha ao recarregar.')).toBeInTheDocument();
    expect(name).toHaveValue('Rascunho');
    expect(screen.getByRole('button', { name: 'Salvar perfil' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Recarregar perfil' }));
    await waitFor(() => expect(name).toHaveValue('Varejo'));
    expect(screen.getByRole('button', { name: 'Salvar perfil' })).toBeEnabled();
    expect(patches).toBe(1);
  });

  it('protects a creation draft during navigation and beforeunload', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname;
        return path === '/api/auth/me' ? jsonResponse(auth('OWNER')) : jsonResponse(list([]));
      }),
    );
    renderRoutes();
    await user.click(await screen.findByRole('button', { name: 'Criar perfil' }));
    await user.type(screen.getByLabelText('Nome'), 'Rascunho');
    const beforeUnload = new Event('beforeunload', { cancelable: true });
    expect(window.dispatchEvent(beforeUnload)).toBe(false);
    await user.click(screen.getByRole('link', { name: 'Sair dos perfis' }));
    expect(await screen.findByText('Descartar alterações não salvas?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continuar editando' }));
    expect(screen.getByLabelText('Nome')).toHaveValue('Rascunho');
    await user.click(screen.getByRole('link', { name: 'Sair dos perfis' }));
    await user.click(screen.getByRole('button', { name: 'Descartar e sair' }));
    expect(
      await screen.findByRole('heading', { name: 'Catálogo de produtos' }),
    ).toBeInTheDocument();
  });

  it('confirms deactivation, preserves the profile and updates it to read-only', async () => {
    const user = userEvent.setup();
    let deactivateCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        if (path === '/api/auth/me') return jsonResponse(auth('OWNER'));
        if (path.endsWith('/deactivate') && init?.method === 'POST') {
          deactivateCalls += 1;
          return jsonResponse(profile(2, { isActive: false }));
        }
        return jsonResponse(profile());
      }),
    );
    renderRoutes(`/app/produtos/precificacao/perfis/${profileId}`);
    await user.click(await screen.findByRole('button', { name: 'Desativar perfil' }));
    expect(screen.getByText(/histórico serão preservados/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(deactivateCalls).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Desativar perfil' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar desativação' }));
    expect(await screen.findByText(/permanece.*somente para consulta/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desativar perfil' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar perfil' })).not.toBeInTheDocument();
    expect(deactivateCalls).toBe(1);
  });

  it.each([
    [409, 'PRICING_REVISION_CONFLICT', 'O perfil mudou.'],
    [500, 'INTERNAL_ERROR', 'Falha ao desativar.'],
  ] as const)(
    'reports structured deactivation failures with status %s',
    async (status, code, message) => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const path = new URL(String(input)).pathname;
          if (path === '/api/auth/me') return jsonResponse(auth('OWNER'));
          if (path.endsWith('/deactivate') && init?.method === 'POST') {
            return pricingError(status, code, message);
          }
          return jsonResponse(profile());
        }),
      );
      renderRoutes(`/app/produtos/precificacao/perfis/${profileId}`);
      await user.click(await screen.findByRole('button', { name: 'Desativar perfil' }));
      await user.click(screen.getByRole('button', { name: 'Confirmar desativação' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        status === 409 ? 'O perfil mudou.' : message,
      );
      expect(screen.getByDisplayValue('Varejo')).toBeEnabled();
    },
  );
});
