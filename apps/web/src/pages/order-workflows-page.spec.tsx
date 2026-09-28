import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { OrderWorkflowsPage } from './order-workflows-page';

const authenticatedUser = {
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
};

const defaultWorkflow = {
  id: 'f25c7c1a-bd29-438f-a940-77d89a93ec50',
  name: 'Fluxo geral',
  isDefault: true,
  isActive: true,
  createdAt: '2026-09-23T12:00:00.000Z',
  updatedAt: '2026-09-23T12:00:00.000Z',
  stages: [
    {
      id: 'c932a51d-744d-465c-8b48-afd8ec2561d0',
      name: 'Pendente',
      position: 1,
      category: 'PENDING',
      isActive: true,
    },
    {
      id: 'd932a51d-744d-465c-8b48-afd8ec2561d0',
      name: 'Em andamento',
      position: 2,
      category: 'IN_PROGRESS',
      isActive: true,
    },
    {
      id: 'e932a51d-744d-465c-8b48-afd8ec2561d0',
      name: 'Concluído',
      position: 3,
      category: 'COMPLETED',
      isActive: true,
    },
  ],
  _count: {
    orders: 3,
  },
};

const configurableWorkflow = {
  ...defaultWorkflow,
  id: 'a932a51d-744d-465c-8b48-afd8ec2561d0',
  name: 'Prestação de serviços',
  isDefault: false,
  createdAt: '2026-09-24T12:00:00.000Z',
  updatedAt: '2026-09-24T12:00:00.000Z',
  _count: {
    orders: 0,
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/app/financeiro/pedidos/fluxos']}>
        <Routes>
          <Route path="/app/financeiro/pedidos/fluxos" element={<OrderWorkflowsPage />} />
          <Route path="/app/financeiro/pedidos" element={<h1>Pedidos</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('OrderWorkflowsPage', () => {
  it('should list workflows with their stages and usage', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);

      if (url.endsWith('/auth/me')) {
        return jsonResponse(authenticatedUser);
      }

      if (url.endsWith('/order-workflows')) {
        return jsonResponse([defaultWorkflow]);
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Fluxos de pedidos',
      }),
    ).toBeInTheDocument();

    expect(await screen.findByText('Fluxo geral')).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    expect(screen.getByText('Em andamento')).toBeInTheDocument();
    expect(screen.getByText('Concluído')).toBeInTheDocument();
    expect(screen.getByText('Padrão')).toBeInTheDocument();
    expect(screen.getByText('3 pedidos utilizam este fluxo.')).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/order-workflows',
      expect.objectContaining({
        credentials: 'include',
      }),
    );
  });

  it('should create a workflow with ordered stages', async () => {
    const user = userEvent.setup();
    let workflows = [defaultWorkflow];

    const createdWorkflow = {
      id: 'a932a51d-744d-465c-8b48-afd8ec2561d0',
      name: 'Produção personalizada',
      isDefault: false,
      isActive: true,
      createdAt: '2026-09-24T12:00:00.000Z',
      updatedAt: '2026-09-24T12:00:00.000Z',
      stages: [
        {
          id: 'b932a51d-744d-465c-8b48-afd8ec2561d0',
          name: 'Arte',
          position: 1,
          category: 'PENDING',
          isActive: true,
        },
        {
          id: 'c832a51d-744d-465c-8b48-afd8ec2561d0',
          name: 'Produção',
          position: 2,
          category: 'IN_PROGRESS',
          isActive: true,
        },
        {
          id: 'd832a51d-744d-465c-8b48-afd8ec2561d0',
          name: 'Pronto',
          position: 3,
          category: 'COMPLETED',
          isActive: true,
        },
      ],
      _count: {
        orders: 0,
      },
    };

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (url.endsWith('/auth/me')) {
          return jsonResponse(authenticatedUser);
        }

        if (url.endsWith('/order-workflows') && init?.method === 'POST') {
          workflows = [...workflows, createdWorkflow];

          return jsonResponse(createdWorkflow, 201);
        }

        if (url.endsWith('/order-workflows')) {
          return jsonResponse(workflows);
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    await user.click(
      await screen.findByRole('button', {
        name: 'Novo fluxo',
      }),
    );

    await user.type(screen.getByLabelText('Nome do fluxo'), 'Produção personalizada');
    await user.type(screen.getByLabelText('Nome da etapa 1'), 'Arte');
    await user.type(screen.getByLabelText('Nome da etapa 2'), 'Produção');
    await user.type(screen.getByLabelText('Nome da etapa 3'), 'Pronto');

    await user.click(
      screen.getByRole('button', {
        name: 'Criar fluxo',
      }),
    );

    expect(await screen.findByText('Produção personalizada')).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/order-workflows',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          name: 'Produção personalizada',
          stages: [{ name: 'Arte' }, { name: 'Produção' }, { name: 'Pronto' }],
        }),
      }),
    );
  });

  it('should set an active workflow as default', async () => {
    const user = userEvent.setup();
    let workflows = [defaultWorkflow, configurableWorkflow];

    const updatedWorkflow = {
      ...configurableWorkflow,
      isDefault: true,
    };

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (url.endsWith('/auth/me')) {
          return jsonResponse(authenticatedUser);
        }

        if (
          url.endsWith(`/order-workflows/${configurableWorkflow.id}/default`) &&
          init?.method === 'POST'
        ) {
          workflows = [
            {
              ...defaultWorkflow,
              isDefault: false,
            },
            updatedWorkflow,
          ];

          return jsonResponse(updatedWorkflow, 201);
        }

        if (url.endsWith('/order-workflows')) {
          return jsonResponse(workflows);
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    await screen.findByText('Prestação de serviços');

    await user.click(
      screen.getByRole('button', {
        name: 'Definir como padrão',
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `http://localhost:3000/api/order-workflows/${configurableWorkflow.id}/default`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
    });

    await waitFor(() => {
      const workflowCard = screen.getByText('Prestação de serviços').closest('[data-slot="card"]');

      expect(workflowCard).toHaveTextContent('Padrão');
    });
  });

  it('should confirm and deactivate a non-default workflow', async () => {
    const user = userEvent.setup();
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);
    let workflows = [defaultWorkflow, configurableWorkflow];

    const deactivatedWorkflow = {
      ...configurableWorkflow,
      isActive: false,
    };

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (url.endsWith('/auth/me')) {
          return jsonResponse(authenticatedUser);
        }

        if (
          url.endsWith(`/order-workflows/${configurableWorkflow.id}/deactivate`) &&
          init?.method === 'POST'
        ) {
          workflows = [defaultWorkflow, deactivatedWorkflow];

          return jsonResponse(deactivatedWorkflow, 201);
        }

        if (url.endsWith('/order-workflows')) {
          return jsonResponse(workflows);
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    await screen.findByText('Prestação de serviços');

    await user.click(
      screen.getByRole('button', {
        name: 'Desativar',
      }),
    );

    expect(confirmMock).toHaveBeenCalledWith(
      'Deseja desativar o fluxo "Prestação de serviços"? Os pedidos existentes continuarão preservados.',
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `http://localhost:3000/api/order-workflows/${configurableWorkflow.id}/deactivate`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
    });

    await waitFor(() => {
      const workflowCard = screen.getByText('Prestação de serviços').closest('[data-slot="card"]');

      expect(workflowCard).toHaveTextContent('Inativo');
      expect(workflowCard).not.toHaveTextContent('Desativar');
    });
  });

  it('should reactivate an inactive workflow', async () => {
    const user = userEvent.setup();

    const inactiveWorkflow = {
      ...configurableWorkflow,
      isActive: false,
    };

    const activatedWorkflow = {
      ...configurableWorkflow,
      isActive: true,
    };

    let workflows = [defaultWorkflow, inactiveWorkflow];

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (url.endsWith('/auth/me')) {
          return jsonResponse(authenticatedUser);
        }

        if (
          url.endsWith(`/order-workflows/${configurableWorkflow.id}/activate`) &&
          init?.method === 'POST'
        ) {
          workflows = [defaultWorkflow, activatedWorkflow];

          return jsonResponse(activatedWorkflow, 201);
        }

        if (url.endsWith('/order-workflows')) {
          return jsonResponse(workflows);
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByText('Inativo')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Reativar',
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `http://localhost:3000/api/order-workflows/${configurableWorkflow.id}/activate`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
    });

    expect(
      await screen.findByRole('button', {
        name: 'Definir como padrão',
      }),
    ).toBeInTheDocument();

    expect(screen.queryByText('Inativo')).not.toBeInTheDocument();
  });

  it('should deny direct workflow configuration access to a viewer', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);

      if (url.endsWith('/auth/me')) {
        return jsonResponse({
          ...authenticatedUser,
          organization: {
            ...authenticatedUser.organization,
            role: 'VIEWER',
          },
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(
      await screen.findByText('Você não possui permissão para configurar fluxos'),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Novo fluxo',
      }),
    ).not.toBeInTheDocument();

    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/order-workflows'))).toBe(
      false,
    );
  });
});
