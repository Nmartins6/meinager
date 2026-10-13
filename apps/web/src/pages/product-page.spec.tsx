import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ProductPage } from './product-page';

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

const product = {
  id: 'f25c7c1a-bd29-438f-a940-77d89a93ec50',
  type: 'PRODUCT',
  name: 'Caneca branca',
  sku: 'CAN-001',
  barcode: null,
  unit: 'UN',
  directCost: '12.500000',
  salePrice: '29.90',
  trackInventory: true,
  minimumStock: '5.000000',
  notes: null,
  isActive: true,
  createdAt: '2026-09-08T12:00:00.000Z',
  updatedAt: '2026-09-08T12:00:00.000Z',
};

const stockBalance = {
  productId: product.id,
  unit: 'UN',
  trackInventory: true,
  minimumStock: '5.000000',
  totalIn: '8.000000',
  totalOut: '5.000000',
  balance: '3.000000',
  isBelowMinimum: true,
};

const stockMovements = {
  data: [
    {
      id: 'a40a67e0-f9e5-4d87-b058-2e575d6e9b90',
      productId: product.id,
      type: 'OUT',
      origin: 'MANUAL',
      quantity: '5.000000',
      reason: 'Uso na produção',
      notes: 'Canecas personalizadas.',
      reversalOfId: null,
      occurredAt: '2026-09-08T14:30:00.000Z',
      createdAt: '2026-09-08T14:30:00.000Z',
    },
  ],
  pagination: {
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
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

function getInventoryResponse(url: string): Response | null {
  const path = new URL(url).pathname;

  if (path === `/api/pricing/products/${product.id}/summary`) {
    return jsonResponse({
      productId: product.id,
      currency: 'BRL',
      salePrice: '29.9',
      priceOrigin: 'MANUAL',
      hasComposition: false,
    });
  }

  if (path === `/api/inventory/products/${product.id}/balance`) {
    return jsonResponse(stockBalance);
  }

  if (path === `/api/inventory/products/${product.id}/movements`) {
    return jsonResponse(stockMovements);
  }

  return null;
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
      <MemoryRouter initialEntries={[`/app/produtos/${product.id}`]}>
        <Routes>
          <Route path="/app/produtos/:productId" element={<ProductPage />} />
          <Route path="/app/produtos" element={<h1>Listagem de produtos</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProductPage', () => {
  it('should let OPERATIONS update a product without sending salePrice', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        const inventoryResponse = getInventoryResponse(url);

        if (inventoryResponse) {
          return inventoryResponse;
        }

        if (url.endsWith('/auth/me')) {
          return jsonResponse({
            ...authenticatedUser,
            organization: {
              ...authenticatedUser.organization,
              role: 'OPERATIONS',
            },
          });
        }

        if (url.endsWith(`/products/${product.id}`) && init?.method === 'PATCH') {
          return jsonResponse({
            ...product,
            directCost: '13.000000',
          });
        }

        if (url.endsWith(`/products/${product.id}`)) {
          return jsonResponse(product);
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    const directCost = await screen.findByLabelText('Custo direto opcional');

    await user.clear(directCost);
    await user.type(directCost, '13');

    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(
      await screen.findByRole('heading', { name: 'Listagem de produtos' }),
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000/api/products/${product.id}`,
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        body: JSON.stringify({
          type: 'PRODUCT',
          name: 'Caneca branca',
          sku: 'CAN-001',
          barcode: null,
          unit: 'UN',
          directCost: '13',
          trackInventory: true,
          minimumStock: '5.000000',
          notes: null,
        }),
      }),
    );
  });

  it('should deactivate a product without leaving the page', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        const inventoryResponse = getInventoryResponse(url);

        if (inventoryResponse) {
          return inventoryResponse;
        }

        if (url.endsWith('/auth/me')) {
          return jsonResponse(authenticatedUser);
        }

        if (url.endsWith(`/products/${product.id}`) && init?.method === 'PATCH') {
          return jsonResponse({
            ...product,
            isActive: false,
          });
        }

        if (url.endsWith(`/products/${product.id}`)) {
          return jsonResponse(product);
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Inativar item' }));

    expect(await screen.findByRole('button', { name: 'Reativar item' })).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000/api/products/${product.id}`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          isActive: false,
        }),
      }),
    );
  });

  it('should hide editing actions from a viewer', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);

      const inventoryResponse = getInventoryResponse(url);

      if (inventoryResponse) {
        return inventoryResponse;
      }

      if (url.endsWith('/auth/me')) {
        return jsonResponse({
          ...authenticatedUser,
          organization: {
            ...authenticatedUser.organization,
            role: 'VIEWER',
          },
        });
      }

      if (url.endsWith(`/products/${product.id}`)) {
        return jsonResponse({ ...product, directCost: undefined });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(
      await screen.findByText('Você não possui permissão para editar este item.'),
    ).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Salvar alterações' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inativar item' })).not.toBeInTheDocument();
  });

  it('should display the stock balance, minimum alert and movement history', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      const inventoryResponse = getInventoryResponse(url);

      if (inventoryResponse) {
        return inventoryResponse;
      }

      if (url.endsWith('/auth/me')) {
        return jsonResponse(authenticatedUser);
      }

      if (url.endsWith(`/products/${product.id}`)) {
        return jsonResponse(product);
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByText('Saldo atual')).toBeInTheDocument();
    expect(screen.getByText('3 UN')).toBeInTheDocument();
    expect(
      screen.getByText(
        'O saldo atual está abaixo do estoque mínimo configurado para este produto.',
      ),
    ).toBeInTheDocument();

    expect(screen.getByText('Histórico de movimentações')).toBeInTheDocument();
    expect(screen.getByText('Uso na produção')).toBeInTheDocument();
    expect(screen.getByText('Canecas personalizadas.')).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000/api/inventory/products/${product.id}/balance`,
      expect.objectContaining({
        credentials: 'include',
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000/api/inventory/products/${product.id}/movements?page=1&pageSize=20`,
      expect.objectContaining({
        credentials: 'include',
      }),
    );
  });

  it('should register a manual stock entry and refresh the available actions', async () => {
    const user = userEvent.setup();

    const createdMovement = {
      id: 'eaf12c19-0d5a-4ef8-a25f-47d9f04d391c',
      productId: product.id,
      type: 'IN',
      origin: 'MANUAL',
      quantity: '12.500000',
      reason: 'Compra de fornecedor',
      notes: 'Reposição do lote de canecas.',
      reversalOfId: null,
      occurredAt: '2026-09-08T16:00:00.000Z',
      createdAt: '2026-09-08T16:00:00.000Z',
    };

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (
          url.endsWith(`/inventory/products/${product.id}/movements`) &&
          init?.method === 'POST'
        ) {
          return jsonResponse(createdMovement, 201);
        }

        const inventoryResponse = getInventoryResponse(url);

        if (inventoryResponse) {
          return inventoryResponse;
        }

        if (url.endsWith('/auth/me')) {
          return jsonResponse(authenticatedUser);
        }

        if (url.endsWith(`/products/${product.id}`)) {
          return jsonResponse(product);
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Registrar movimentação' }));

    await user.type(screen.getByLabelText('Quantidade'), '12.5');
    await user.type(screen.getByLabelText('Motivo'), 'Compra de fornecedor');
    await user.type(
      screen.getByLabelText('Observações da movimentação'),
      'Reposição do lote de canecas.',
    );

    await user.click(screen.getByRole('button', { name: 'Confirmar entrada' }));

    expect(
      await screen.findByRole('button', { name: 'Registrar movimentação' }),
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000/api/inventory/products/${product.id}/movements`,
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          type: 'IN',
          quantity: '12.5',
          reason: 'Compra de fornecedor',
          notes: 'Reposição do lote de canecas.',
        }),
      }),
    );
  });

  it('should reject a stock withdrawal greater than the displayed balance', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      const inventoryResponse = getInventoryResponse(url);

      if (inventoryResponse) {
        return inventoryResponse;
      }

      if (url.endsWith('/auth/me')) {
        return jsonResponse(authenticatedUser);
      }

      if (url.endsWith(`/products/${product.id}`)) {
        return jsonResponse(product);
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Registrar movimentação' }));

    await user.selectOptions(screen.getByLabelText('Tipo de movimentação'), 'OUT');
    await user.type(screen.getByLabelText('Quantidade'), '3.1');
    await user.type(screen.getByLabelText('Motivo'), 'Uso na produção');

    await user.click(screen.getByRole('button', { name: 'Confirmar saída' }));

    expect(
      await screen.findByText('A quantidade da saída não pode ultrapassar o saldo atual.'),
    ).toBeInTheDocument();

    expect(fetchMock).not.toHaveBeenCalledWith(
      `http://localhost:3000/api/inventory/products/${product.id}/movements`,
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('should adjust stock using the current displayed balance', async () => {
    const user = userEvent.setup();

    const adjustmentResponse = {
      productId: product.id,
      previousBalance: '3.000000',
      balance: '10.000000',
      movement: {
        id: '497a849c-842f-4e80-b8db-0b6d6788c434',
        productId: product.id,
        type: 'IN',
        origin: 'ADJUSTMENT',
        quantity: '7.000000',
        reason: 'Inventário mensal',
        notes: 'Contagem realizada no depósito.',
        reversalOfId: null,
        occurredAt: '2026-09-08T17:00:00.000Z',
        createdAt: '2026-09-08T17:00:00.000Z',
      },
    };

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (
          url.endsWith(`/inventory/products/${product.id}/adjustments`) &&
          init?.method === 'POST'
        ) {
          return jsonResponse(adjustmentResponse);
        }

        const inventoryResponse = getInventoryResponse(url);

        if (inventoryResponse) {
          return inventoryResponse;
        }

        if (url.endsWith('/auth/me')) {
          return jsonResponse(authenticatedUser);
        }

        if (url.endsWith(`/products/${product.id}`)) {
          return jsonResponse(product);
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Registrar ajuste físico' }));

    await user.type(screen.getByLabelText('Contagem física'), '10');
    await user.type(screen.getByLabelText('Motivo do ajuste'), 'Inventário mensal');
    await user.type(
      screen.getByLabelText('Observações do ajuste'),
      'Contagem realizada no depósito.',
    );

    await user.click(screen.getByRole('button', { name: 'Confirmar ajuste' }));

    expect(
      await screen.findByRole('button', { name: 'Registrar ajuste físico' }),
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000/api/inventory/products/${product.id}/adjustments`,
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          countedQuantity: '10',
          expectedBalance: '3.000000',
          reason: 'Inventário mensal',
          notes: 'Contagem realizada no depósito.',
        }),
      }),
    );
  });

  it('should reject a negative physical count before calling the API', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      const inventoryResponse = getInventoryResponse(url);

      if (inventoryResponse) {
        return inventoryResponse;
      }

      if (url.endsWith('/auth/me')) {
        return jsonResponse(authenticatedUser);
      }

      if (url.endsWith(`/products/${product.id}`)) {
        return jsonResponse(product);
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Registrar ajuste físico' }));

    await user.type(screen.getByLabelText('Contagem física'), '-1');
    await user.type(screen.getByLabelText('Motivo do ajuste'), 'Inventário mensal');

    await user.click(screen.getByRole('button', { name: 'Confirmar ajuste' }));

    expect(
      await screen.findByText(
        'Informe uma contagem não negativa, com até 12 dígitos inteiros e 6 casas decimais.',
      ),
    ).toBeInTheDocument();

    expect(fetchMock).not.toHaveBeenCalledWith(
      `http://localhost:3000/api/inventory/products/${product.id}/adjustments`,
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('should reverse a stock movement and preserve the original record', async () => {
    const user = userEvent.setup();
    const originalMovement = stockMovements.data[0];

    const reversedMovement = {
      id: 'dd2f868c-4426-4cdb-a282-e0830f381de8',
      productId: product.id,
      type: 'IN',
      origin: 'REVERSAL',
      quantity: '5.000000',
      reason: 'Registro informado incorretamente',
      notes: 'A saída não ocorreu.',
      reversalOfId: originalMovement.id,
      occurredAt: '2026-09-08T18:00:00.000Z',
      createdAt: '2026-09-08T18:00:00.000Z',
    };

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (
          url.endsWith(
            `/inventory/products/${product.id}/movements/${originalMovement.id}/reverse`,
          ) &&
          init?.method === 'POST'
        ) {
          return jsonResponse(reversedMovement, 201);
        }

        const inventoryResponse = getInventoryResponse(url);

        if (inventoryResponse) {
          return inventoryResponse;
        }

        if (url.endsWith('/auth/me')) {
          return jsonResponse(authenticatedUser);
        }

        if (url.endsWith(`/products/${product.id}`)) {
          return jsonResponse(product);
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Estornar' }));

    await user.type(
      screen.getByLabelText('Motivo do estorno'),
      'Registro informado incorretamente',
    );
    await user.type(screen.getByLabelText('Observações do estorno'), 'A saída não ocorreu.');

    await user.click(screen.getByRole('button', { name: 'Confirmar estorno' }));

    expect(await screen.findByRole('button', { name: 'Estornar' })).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000/api/inventory/products/${product.id}/movements/${originalMovement.id}/reverse`,
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          reason: 'Registro informado incorretamente',
          notes: 'A saída não ocorreu.',
        }),
      }),
    );
  });

  it('should not offer a reversal action for a reversal movement', async () => {
    const reversalHistory = {
      ...stockMovements,
      data: [
        {
          ...stockMovements.data[0],
          id: 'df857aa7-5e9a-4ff5-aec4-4a8adbaaf1c6',
          type: 'IN',
          origin: 'REVERSAL',
          reversalOfId: 'ef1b0a0c-4809-4634-96ce-846a184c2378',
        },
      ],
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      const path = new URL(url).pathname;

      if (path === `/api/inventory/products/${product.id}/balance`) {
        return jsonResponse(stockBalance);
      }

      if (path === `/api/inventory/products/${product.id}/movements`) {
        return jsonResponse(reversalHistory);
      }

      if (path === `/api/pricing/products/${product.id}/summary`) {
        return jsonResponse({
          productId: product.id,
          currency: 'BRL',
          salePrice: '29.9',
          priceOrigin: 'MANUAL',
          hasComposition: false,
        });
      }

      if (url.endsWith('/auth/me')) {
        return jsonResponse(authenticatedUser);
      }

      if (url.endsWith(`/products/${product.id}`)) {
        return jsonResponse(product);
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByText('Estorno')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Estornar' })).not.toBeInTheDocument();
  });
});
