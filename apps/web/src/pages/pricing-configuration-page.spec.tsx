import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';

import type { OrganizationRole } from '@/features/pricing/pricing-permissions';

import { PricingConfigurationPage } from './pricing-configuration-page';

const userId = '53a6ba71-77b9-4aca-9493-e08e7dd11b83';

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

const origin = {
  schemaVersion: 1,
  origin: 'MANUAL',
  source: null,
  referenceId: null,
  periodStart: null,
  periodEnd: null,
  criterion: null,
  measuredAt: null,
  confirmedByUserId: userId,
};

const emptyOriginInput = {
  origin: 'MANUAL',
  source: null,
  referenceId: null,
  periodStart: null,
  periodEnd: null,
  criterion: null,
  measuredAt: null,
};

function configuration(revision = 2, margin = '0.25') {
  return {
    id: '7d9805c3-00ba-486e-a59b-188c72aa3551',
    isActive: true,
    currentRevision: {
      id:
        revision === 2
          ? 'cf2c1950-fb93-4490-864a-99e02990f4f1'
          : 'f221441c-3d25-4adb-bd73-9155d889262f',
      revision,
      effectiveFrom: '2026-10-13T12:00:00.000Z',
      currency: 'BRL',
      fixedCostMode: 'RATE',
      fixedCostRate: '0.125',
      monthlyFixedCost: null,
      averageMonthlyRevenue: null,
      monthlyLaborCost: '1000',
      productiveHours: '160',
      defaultDesiredMargin: margin,
      parameterOrigins: {
        fixedCostMode: origin,
        fixedCostRate: origin,
        monthlyLaborCost: origin,
        productiveHours: origin,
        defaultDesiredMargin: origin,
      },
      createdAt: '2026-10-13T12:00:00.000Z',
    },
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function pricingError(status: number, code: string, message: string, details?: unknown) {
  return jsonResponse(
    {
      statusCode: status,
      code,
      message,
      ...(details ? { field: 'expectedRevision', details } : {}),
    },
    status,
  );
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      {
        path: '/app/produtos/precificacao/configuracao',
        element: (
          <>
            <Link to="/app/produtos">Sair da configuração</Link>
            <PricingConfigurationPage />
          </>
        ),
      },
      { path: '/app/produtos', element: <h1>Catálogo de produtos</h1> },
    ],
    { initialEntries: ['/app/produtos/precificacao/configuracao'] },
  );

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
    router,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PricingConfigurationPage', () => {
  it('loads an existing configuration, shows human percentages and handles no-op explicitly', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path === '/api/auth/me') return jsonResponse(auth('OWNER'));
      if (path === '/api/pricing/configuration') return jsonResponse(configuration());
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByDisplayValue('12.5')).toBeInTheDocument();
    expect(screen.getByDisplayValue('25')).toBeInTheDocument();
    expect(screen.getByText('Revisão atual')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salvar configuração' }));

    expect(await screen.findByText(/Nenhuma alteração para salvar/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(0);
    await user.click(screen.getByRole('link', { name: 'Sair da configuração' }));
    expect(
      await screen.findByRole('heading', { name: 'Catálogo de produtos' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Descartar alterações não salvas?')).not.toBeInTheDocument();
  });

  it.each(['OWNER', 'ADMIN'] as const)(
    'lets %s create the initial configuration with expectedRevision null',
    async (role) => {
      const user = userEvent.setup();
      const bodies: unknown[] = [];
      const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        if (path === '/api/auth/me') return jsonResponse(auth(role));
        if (path === '/api/pricing/configuration' && init?.method === 'PATCH') {
          bodies.push(JSON.parse(String(init.body)));
          return jsonResponse(configuration(1));
        }
        if (path === '/api/pricing/configuration') {
          return pricingError(404, 'PRICING_CONFIGURATION_NOT_FOUND', 'Não encontrada.');
        }
        throw new Error(`Unexpected request: ${path}`);
      });
      vi.stubGlobal('fetch', fetchMock);

      renderPage();
      await user.click(await screen.findByRole('button', { name: 'Criar configuração' }));
      await user.selectOptions(screen.getByLabelText('Tratamento dos custos fixos'), 'RATE');
      await user.type(screen.getByLabelText('Custos fixos'), '12,5');
      await user.click(screen.getByRole('button', { name: 'Criar configuração' }));

      await waitFor(() => expect(bodies).toHaveLength(1));
      expect(bodies[0]).toEqual({
        expectedRevision: null,
        currency: 'BRL',
        fixedCostMode: 'RATE',
        fixedCostRate: '0.125',
        parameterOrigins: {
          fixedCostMode: emptyOriginInput,
          fixedCostRate: emptyOriginInput,
        },
      });
    },
  );

  it.each(['OWNER', 'ADMIN'] as const)(
    'lets %s update only the changed field with the current revision and origin',
    async (role) => {
      const user = userEvent.setup();
      const bodies: unknown[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const path = new URL(String(input)).pathname;
          if (path === '/api/auth/me') return jsonResponse(auth(role));
          if (init?.method === 'PATCH') {
            bodies.push(JSON.parse(String(init.body)));
            return jsonResponse(configuration(3, '0.3'));
          }
          return jsonResponse(configuration());
        }),
      );

      renderPage();
      const margin = await screen.findByLabelText('Margem desejada padrão');
      await user.clear(margin);
      await user.type(margin, '30,00');
      await user.click(screen.getByRole('button', { name: 'Salvar configuração' }));

      await waitFor(() => expect(bodies).toHaveLength(1));
      expect(bodies[0]).toEqual({
        expectedRevision: 2,
        defaultDesiredMargin: '0.3',
        parameterOrigins: { defaultDesiredMargin: emptyOriginInput },
      });
      expect(await screen.findByText('Configuração salva na revisão 3.')).toBeInTheDocument();
      await user.click(screen.getByRole('link', { name: 'Sair da configuração' }));
      expect(
        await screen.findByRole('heading', { name: 'Catálogo de produtos' }),
      ).toBeInTheDocument();
      expect(screen.queryByText('Descartar alterações não salvas?')).not.toBeInTheDocument();
    },
  );

  it.each(['OPERATIONS', 'FINANCE'] as const)('gives %s read-only access', async (role) => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        new URL(String(input)).pathname === '/api/auth/me'
          ? jsonResponse(auth(role))
          : jsonResponse(configuration()),
      ),
    );

    renderPage();

    expect(await screen.findByText(/sem realizar alterações/)).toBeInTheDocument();
    expect(screen.getByLabelText('Margem desejada padrão')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Salvar configuração' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Sair da configuração' }));
    expect(
      await screen.findByRole('heading', { name: 'Catálogo de produtos' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Descartar alterações não salvas?')).not.toBeInTheDocument();
  });

  it('does not request or expose internal configuration to VIEWER', async () => {
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

    renderPage();

    expect(await screen.findByText(/não está disponível para seu papel/)).toBeInTheDocument();
    expect(screen.queryByText('Parâmetros editáveis')).not.toBeInTheDocument();
    expect(requested).toEqual(['/api/auth/me']);
  });

  it.each([
    [401, 'AUTHENTICATION_REQUIRED', 'Sua sessão expirou.'],
    [403, 'PRICING_FORBIDDEN', 'Você não tem permissão.'],
  ] as const)(
    'shows the stable %s response without retrying automatically',
    async (status, code, message) => {
      let configurationCalls = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const path = new URL(String(input)).pathname;
          if (path === '/api/auth/me') return jsonResponse(auth('OWNER'));
          configurationCalls += 1;
          return pricingError(status, code, message);
        }),
      );

      renderPage();

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(configurationCalls).toBe(1);
    },
  );

  it('shows loading, reports a recoverable error and retries explicitly', async () => {
    const user = userEvent.setup();
    let resolveFirst: (() => void) | undefined;
    const first = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    let configurationCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname;
        if (path === '/api/auth/me') return jsonResponse(auth('OWNER'));
        configurationCalls += 1;
        if (configurationCalls === 1) {
          await first;
          return pricingError(500, 'INTERNAL_ERROR', 'Falha temporária.');
        }
        return jsonResponse(configuration());
      }),
    );

    renderPage();
    expect(
      await screen.findByText('Carregando configuração de precificação...'),
    ).toBeInTheDocument();
    resolveFirst?.();
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha temporária.');
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByDisplayValue('25')).toBeInTheDocument();
    expect(configurationCalls).toBe(2);
  });

  it.each(['PRICING_REVISION_CONFLICT', 'PRICING_CONCURRENT_MODIFICATION'] as const)(
    'preserves the draft on %s and reloads only after the explicit action',
    async (code) => {
      const user = userEvent.setup();
      let configurationCalls = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const path = new URL(String(input)).pathname;
          if (path === '/api/auth/me') return jsonResponse(auth('OWNER'));
          if (init?.method === 'PATCH') {
            return pricingError(409, code, 'A revisão mudou.', {
              expectedRevision: 2,
              currentRevision: 3,
            });
          }
          configurationCalls += 1;
          return jsonResponse(
            configurationCalls === 1 ? configuration() : configuration(3, '0.35'),
          );
        }),
      );

      renderPage();
      const margin = await screen.findByLabelText('Margem desejada padrão');
      await user.clear(margin);
      await user.type(margin, '30');
      await user.click(screen.getByRole('button', { name: 'Salvar configuração' }));

      expect(await screen.findByText(/Seu rascunho foi preservado/)).toBeInTheDocument();
      expect(margin).toHaveValue('30');
      expect(configurationCalls).toBe(1);

      await user.click(screen.getByRole('button', { name: 'Recarregar configuração' }));
      await waitFor(() =>
        expect(screen.getByLabelText('Margem desejada padrão')).toHaveValue('35'),
      );
      expect(configurationCalls).toBe(2);
      await user.click(screen.getByRole('link', { name: 'Sair da configuração' }));
      expect(
        await screen.findByRole('heading', { name: 'Catálogo de produtos' }),
      ).toBeInTheDocument();
      expect(screen.queryByText('Descartar alterações não salvas?')).not.toBeInTheDocument();
    },
  );

  it('preserves conflict and draft when reload fails, then permits a successful retry', async () => {
    const user = userEvent.setup();
    let configurationCalls = 0;
    let patchCalls = 0;
    let finishFailedReload: (() => void) | undefined;
    const failedReloadPending = new Promise<void>((resolve) => {
      finishFailedReload = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        if (path === '/api/auth/me') return jsonResponse(auth('OWNER'));
        if (init?.method === 'PATCH') {
          patchCalls += 1;
          return pricingError(409, 'PRICING_REVISION_CONFLICT', 'A revisão mudou.', {
            expectedRevision: 2,
            currentRevision: 3,
          });
        }

        configurationCalls += 1;
        if (configurationCalls === 1) return jsonResponse(configuration());
        if (configurationCalls === 2) {
          await failedReloadPending;
          return pricingError(500, 'INTERNAL_ERROR', 'Falha ao recarregar.');
        }
        return jsonResponse(configuration(3, '0.35'));
      }),
    );

    renderPage();
    const margin = await screen.findByLabelText('Margem desejada padrão');
    await user.clear(margin);
    await user.type(margin, '30');
    await user.click(screen.getByRole('button', { name: 'Salvar configuração' }));
    expect(await screen.findByText(/Seu rascunho foi preservado/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Recarregar configuração' }));
    const pendingReload = screen.getByRole('button', { name: 'Recarregando...' });
    expect(pendingReload).toBeDisabled();
    finishFailedReload?.();

    expect(await screen.findByText('Falha ao recarregar.')).toHaveAttribute('role', 'alert');
    expect(screen.getAllByText('Falha ao recarregar.')).toHaveLength(1);
    expect(margin).toHaveValue('30');
    expect(screen.getByText(/Seu rascunho foi preservado/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar configuração' })).toBeDisabled();
    expect(patchCalls).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Recarregar configuração' }));
    await waitFor(() => expect(screen.getByLabelText('Margem desejada padrão')).toHaveValue('35'));
    expect(screen.queryByText('Falha ao recarregar.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Seu rascunho foi preservado/)).not.toBeInTheDocument();
    expect(patchCalls).toBe(1);
  });

  it('blocks internal navigation and beforeunload while an editable draft is dirty', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        new URL(String(input)).pathname === '/api/auth/me'
          ? jsonResponse(auth('OWNER'))
          : jsonResponse(configuration()),
      ),
    );

    renderPage();
    const margin = await screen.findByLabelText('Margem desejada padrão');
    await user.clear(margin);
    await user.type(margin, '30');

    const beforeUnload = new Event('beforeunload', { cancelable: true });
    expect(window.dispatchEvent(beforeUnload)).toBe(false);
    expect(beforeUnload.defaultPrevented).toBe(true);

    await user.click(screen.getByRole('link', { name: 'Sair da configuração' }));
    expect(
      await screen.findByRole('heading', { name: 'Descartar alterações não salvas?' }),
    ).toBeInTheDocument();
    expect(margin).toHaveValue('30');

    await user.click(screen.getByRole('button', { name: 'Continuar editando' }));
    expect(screen.queryByText('Descartar alterações não salvas?')).not.toBeInTheDocument();
    expect(margin).toHaveValue('30');

    await user.click(screen.getByRole('link', { name: 'Sair da configuração' }));
    await user.click(screen.getByRole('button', { name: 'Descartar e sair' }));
    expect(
      await screen.findByRole('heading', { name: 'Catálogo de produtos' }),
    ).toBeInTheDocument();
  });

  it('restores persisted values on cancel and associates validation with the field', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) =>
      new URL(String(input)).pathname === '/api/auth/me'
        ? jsonResponse(auth('OWNER'))
        : jsonResponse(configuration()),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    const rate = await screen.findByLabelText('Custos fixos');
    await user.clear(rate);
    await user.type(rate, '1e2');
    await user.click(screen.getByRole('button', { name: 'Salvar configuração' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('percentual válido');
    expect(rate).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(rate).toHaveValue('12.5');
    const beforeUnload = new Event('beforeunload', { cancelable: true });
    expect(window.dispatchEvent(beforeUnload)).toBe(true);
    expect(beforeUnload.defaultPrevented).toBe(false);
    await user.click(screen.getByRole('link', { name: 'Sair da configuração' }));
    expect(
      await screen.findByRole('heading', { name: 'Catálogo de produtos' }),
    ).toBeInTheDocument();
  });

  it('associates provenance validation with the corresponding metadata field', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) =>
      new URL(String(input)).pathname === '/api/auth/me'
        ? jsonResponse(auth('OWNER'))
        : jsonResponse(configuration()),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await user.click(await screen.findByText('Origem de percentual de custos fixos'));
    const periodStart = screen.getByLabelText('Início do período (ISO 8601)', {
      selector: '#fixedCostRate-period-start',
    });
    await user.type(periodStart, 'data inválida');
    const rate = screen.getByLabelText('Custos fixos');
    await user.clear(rate);
    await user.type(rate, '13');
    await user.click(screen.getByRole('button', { name: 'Salvar configuração' }));

    expect(await screen.findByText('Informe uma data ISO 8601 válida.')).toBeInTheDocument();
    expect(periodStart).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(0);
  });
});
