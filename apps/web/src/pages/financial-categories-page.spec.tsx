import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { FinancialCategoriesPage } from './financial-categories-page';

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

const existingCategory = {
  id: '28dc8395-5a6e-45a8-a08d-400b85274871',
  name: 'Aluguel',
  type: 'FIXED_EXPENSE',
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

function renderPage() {
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
      <MemoryRouter initialEntries={['/app/financeiro/categorias']}>
        <FinancialCategoriesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FinancialCategoriesPage', () => {
  it('should list financial categories', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);

      if (url.endsWith('/auth/me')) {
        return jsonResponse(authenticatedUser);
      }

      if (url.includes('/finance/categories')) {
        return jsonResponse([existingCategory]);
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByText('Aluguel')).toBeInTheDocument();
    expect(screen.getByText('Custo fixo')).toBeInTheDocument();
    expect(screen.getByText('Ativa')).toBeInTheDocument();
  });

  it('should validate and create a financial category', async () => {
    const user = userEvent.setup();
    const categories = [existingCategory];

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (url.endsWith('/auth/me')) {
          return jsonResponse(authenticatedUser);
        }

        if (url.includes('/finance/categories') && init?.method === 'POST') {
          const body = JSON.parse(String(init.body)) as {
            name: string;
            type: 'REVENUE' | 'FIXED_EXPENSE' | 'VARIABLE_EXPENSE';
          };

          const createdCategory = {
            id: 'cff97850-c427-4d65-817e-ddd5cf597b56',
            name: body.name,
            type: body.type,
            isActive: true,
            createdAt: '2026-09-05T13:00:00.000Z',
            updatedAt: '2026-09-05T13:00:00.000Z',
          };

          categories.push(createdCategory);

          return jsonResponse(createdCategory, 201);
        }

        if (url.includes('/finance/categories')) {
          return jsonResponse(categories);
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    await screen.findByText('Aluguel');

    await user.click(
      screen.getByRole('button', {
        name: 'Nova categoria',
      }),
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Criar categoria',
      }),
    );

    expect(
      await screen.findByText('Informe um nome com pelo menos 2 caracteres.'),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText('Nome'), 'Matéria-prima');

    await user.selectOptions(
      screen.getByLabelText('Tipo', {
        selector: '#new-category-type',
      }),
      'VARIABLE_EXPENSE',
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Criar categoria',
      }),
    );

    expect(await screen.findByText('Matéria-prima')).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/finance/categories',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          name: 'Matéria-prima',
          type: 'VARIABLE_EXPENSE',
        }),
      }),
    );
  });

  it('should hide management actions from a viewer', async () => {
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

      if (url.includes('/finance/categories')) {
        return jsonResponse([existingCategory]);
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByText('Aluguel')).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Nova categoria',
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Renomear',
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Inativar',
      }),
    ).not.toBeInTheDocument();
  });
});
