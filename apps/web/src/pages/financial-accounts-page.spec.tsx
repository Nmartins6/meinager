import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { FinancialAccountsPage } from './financial-accounts-page';

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

const existingAccount = {
  id: 'd6614e80-0bd7-498c-a906-2b18c1227a71',
  name: 'Caixa principal',
  type: 'CASH',
  openingBalance: '-250.50',
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
      <MemoryRouter initialEntries={['/app/financeiro/contas']}>
        <FinancialAccountsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FinancialAccountsPage', () => {
  it('should list and format financial accounts', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);

      if (url.endsWith('/auth/me')) {
        return jsonResponse(authenticatedUser);
      }

      if (url.includes('/finance/accounts')) {
        return jsonResponse([existingAccount]);
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.getByText('Carregando contas financeiras...')).toBeInTheDocument();

    expect(await screen.findByText('Caixa principal')).toBeInTheDocument();
    expect(screen.getByText('-R$ 250,50')).toBeInTheDocument();
    expect(screen.getByText('Ativa')).toBeInTheDocument();
  });

  it('should validate and create a financial account', async () => {
    const user = userEvent.setup();
    const accounts = [existingAccount];

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (url.endsWith('/auth/me')) {
          return jsonResponse(authenticatedUser);
        }

        if (url.includes('/finance/accounts') && init?.method === 'POST') {
          const body = JSON.parse(String(init.body)) as {
            name: string;
            type: 'CASH' | 'CHECKING_ACCOUNT' | 'SAVINGS_ACCOUNT' | 'DIGITAL_WALLET' | 'OTHER';
            openingBalance: string;
          };

          const createdAccount = {
            id: '85ebda37-293c-4d4c-93e7-e019cc80ba29',
            name: body.name,
            type: body.type,
            openingBalance: '1500.25',
            isActive: true,
            createdAt: '2026-09-05T13:00:00.000Z',
            updatedAt: '2026-09-05T13:00:00.000Z',
          };

          accounts.push(createdAccount);

          return jsonResponse(createdAccount, 201);
        }

        if (url.includes('/finance/accounts')) {
          return jsonResponse(accounts);
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    await screen.findByText('Caixa principal');

    await user.click(
      screen.getByRole('button', {
        name: 'Nova conta',
      }),
    );

    await user.clear(screen.getByLabelText('Saldo inicial'));
    await user.type(screen.getByLabelText('Saldo inicial'), 'valor-inválido');

    await user.click(
      screen.getByRole('button', {
        name: 'Criar conta',
      }),
    );

    expect(
      await screen.findByText('Informe um nome com pelo menos 2 caracteres.'),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText('Nome'), 'Conta principal');

    await user.clear(screen.getByLabelText('Saldo inicial'));
    await user.type(screen.getByLabelText('Saldo inicial'), '1500.25');

    await user.selectOptions(
      screen.getByLabelText('Tipo', {
        selector: '#new-account-type',
      }),
      'CHECKING_ACCOUNT',
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Criar conta',
      }),
    );

    expect(await screen.findByText('Conta principal')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.500,25')).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/finance/accounts',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          name: 'Conta principal',
          type: 'CHECKING_ACCOUNT',
          openingBalance: '1500.25',
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

      if (url.includes('/finance/accounts')) {
        return jsonResponse([existingAccount]);
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByText('Caixa principal')).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Nova conta',
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Editar',
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Inativar',
      }),
    ).not.toBeInTheDocument();
  });
});
