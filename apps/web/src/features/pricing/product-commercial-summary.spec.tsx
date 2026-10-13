import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ProductCommercialSummary } from './product-commercial-summary';

const productId = 'f25c7c1a-bd29-438f-a940-77d89a93ec50';
const summary = {
  productId,
  currency: 'BRL',
  salePrice: '29.9',
  priceOrigin: 'PRICING_VERSION',
  hasComposition: true,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderSummary(role: 'OWNER' | 'ADMIN' | 'OPERATIONS' | 'FINANCE' | 'VIEWER') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ProductCommercialSummary productId={productId} role={role} />
      </QueryClientProvider>,
    ),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProductCommercialSummary', () => {
  it('shows only the commercial projection and the manual action to OWNER', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(summary)),
    );

    renderSummary('OWNER');

    expect(await screen.findByText('R$ 29,90')).toBeInTheDocument();
    expect(screen.getByText('Versão de precificação')).toBeInTheDocument();
    expect(screen.getByText('Composição cadastrada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Definir preço manual' })).toBeInTheDocument();
    expect(screen.queryByText(/custo|margem|lucro|dedução|snapshot/i)).not.toBeInTheDocument();
  });

  it.each(['OPERATIONS', 'FINANCE', 'VIEWER'] as const)(
    'hides the manual action from %s',
    async (role) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => jsonResponse(summary)),
      );

      renderSummary(role);

      expect(await screen.findByText('R$ 29,90')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Definir preço manual' }),
      ).not.toBeInTheDocument();
    },
  );

  it('sends an equal string explicitly, normalizes one comma and sends null', async () => {
    const user = userEvent.setup();
    const patchBodies: unknown[] = [];
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        if (init?.method === 'PATCH') {
          patchBodies.push(JSON.parse(String(init.body)));
          return jsonResponse({});
        }

        return jsonResponse(summary);
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    renderSummary('ADMIN');
    const trigger = await screen.findByRole('button', { name: 'Definir preço manual' });
    await user.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Definir preço manual' });
    const input = screen.getByLabelText('Preço de venda');
    expect(input).toHaveFocus();
    expect(input).toHaveValue('29.9');
    expect(dialog).toHaveTextContent('remove a origem vinculada à versão de precificação');

    await user.click(screen.getByRole('button', { name: 'Confirmar preço' }));
    expect(await screen.findByText('Preço manual atualizado.')).toBeInTheDocument();
    expect(patchBodies[0]).toEqual({ salePrice: '29.9' });

    await user.clear(input);
    await user.type(input, '31,50');
    expect(input).toHaveValue('31,50');
    await user.click(screen.getByRole('button', { name: 'Confirmar preço' }));
    await waitFor(() => expect(patchBodies).toHaveLength(2));
    expect(patchBodies[1]).toEqual({ salePrice: '31.5' });

    await user.click(screen.getByRole('button', { name: 'Remover preço' }));
    await waitFor(() => expect(patchBodies).toHaveLength(3));
    expect(patchBodies[2]).toEqual({ salePrice: null });

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('shows a structured 403 returned after the dialog is rendered', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          return jsonResponse(
            {
              statusCode: 403,
              code: 'PRICING_FORBIDDEN',
              message: 'Você não tem permissão para realizar esta ação.',
            },
            403,
          );
        }

        return jsonResponse(summary);
      }),
    );

    renderSummary('OWNER');
    await user.click(await screen.findByRole('button', { name: 'Definir preço manual' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar preço' }));

    expect(
      await screen.findByRole('alert', {
        name: '',
      }),
    ).toHaveTextContent('Você não tem permissão');
  });

  it('shows loading, a retryable error and the empty commercial states', async () => {
    const user = userEvent.setup();
    let attempt = 0;
    let releaseFirstRequest: (() => void) | undefined;
    const firstRequest = new Promise<void>((resolve) => {
      releaseFirstRequest = resolve;
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        attempt += 1;
        if (attempt === 1) {
          await firstRequest;
          return jsonResponse({ message: 'Falha temporária.' }, 503);
        }

        return jsonResponse({
          ...summary,
          salePrice: null,
          priceOrigin: 'MANUAL',
          hasComposition: false,
        });
      }),
    );

    renderSummary('VIEWER');
    expect(screen.getByRole('status')).toHaveTextContent('Carregando resumo comercial');
    releaseFirstRequest?.();

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha temporária.');
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Sem preço definido')).toBeInTheDocument();
    expect(screen.getByText('Preço manual')).toBeInTheDocument();
    expect(screen.getByText('Sem composição cadastrada')).toBeInTheDocument();
  });
});
