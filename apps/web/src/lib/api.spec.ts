import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

import {
  ApiError,
  apiRequest,
  getCurrentUser,
  getOrganizationContextVersion,
  parseApiError,
  setOrganizationContext,
} from './api';

afterEach(() => {
  setOrganizationContext(null);
  vi.restoreAllMocks();
});

describe('organization request context', () => {
  it('sends the tab context on organizational requests, but not authentication', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    setOrganizationContext('72967066-9611-4ef6-b49f-e9c7c9178d83');
    await apiRequest('/organization/invitations');
    await apiRequest('/auth/me');
    expect(new Headers(fetchMock.mock.calls[0]![1]?.headers).get('X-Organization-Context')).toBe(
      '72967066-9611-4ef6-b49f-e9c7c9178d83',
    );
    expect(
      new Headers(fetchMock.mock.calls[0]![1]?.headers).get('X-Organization-Context-Version'),
    ).toBe('0');
    expect(
      new Headers(fetchMock.mock.calls[1]![1]?.headers).get('X-Organization-Context'),
    ).toBeNull();
  });

  it('does not downgrade the tab generation after an older auth response arrives', async () => {
    const organizationId = '72967066-9611-4ef6-b49f-e9c7c9178d83';
    setOrganizationContext(organizationId, 3);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: {
            id: '24392cc5-a5d3-47f1-87b0-6a8a91318712',
            name: 'Pessoa',
            email: 'pessoa@example.invalid',
          },
          organization: { id: organizationId, name: 'Casa', slug: 'casa', role: 'ADMIN' },
          organizations: [{ id: organizationId, name: 'Casa', slug: 'casa', role: 'ADMIN' }],
          contextVersion: 1,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    await getCurrentUser();
    expect(getOrganizationContextVersion()).toBe(3);
  });

  it('rejects a late response after A → B → A even when the organization ID matches', async () => {
    const organizationId = '72967066-9611-4ef6-b49f-e9c7c9178d83';
    let deliver: ((response: Response) => void) | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
      () => new Promise<Response>((resolve) => (deliver = resolve)),
    );
    setOrganizationContext(organizationId, 1);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const pending = queryClient.fetchQuery({
      queryKey: ['clients'],
      queryFn: async () => (await apiRequest('/clients')).json(),
    });
    setOrganizationContext('cfa64698-4cdb-44dd-beb2-1a1c42125f58', 2);
    setOrganizationContext(organizationId, 3);
    deliver?.(new Response(JSON.stringify({ data: [{ name: 'stale' }] }), { status: 200 }));
    await expect(pending).rejects.toMatchObject({ status: 409 });
    expect(queryClient.getQueryData(['clients'])).toBeUndefined();
    queryClient.clear();
  });
});

describe('parseApiError', () => {
  it('preserves validated structured pricing errors', () => {
    const error = parseApiError(
      {
        statusCode: 409,
        code: 'PRICING_REVISION_CONFLICT',
        message: 'A configuração foi alterada.',
        field: 'expectedRevision',
        details: { expectedRevision: 1, currentRevision: 2 },
      },
      409,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      statusCode: 409,
      code: 'PRICING_REVISION_CONFLICT',
      message: 'A configuração foi alterada.',
      field: 'expectedRevision',
      details: { expectedRevision: 1, currentRevision: 2 },
    });
  });

  it('keeps only the message from a legacy response with additional properties', () => {
    const error = parseApiError(
      {
        statusCode: 400,
        error: 'Bad Request',
        message: ['Nome inválido.', 'Revise os dados.'],
        stack: 'SERVER_STACK_MARKER',
        sql: 'SELECT secret',
        prisma: { code: 'P2002' },
        details: { internal: true },
      },
      400,
    );

    expect(error).toMatchObject({
      status: 400,
      statusCode: 400,
      message: 'Nome inválido. Revise os dados.',
      code: undefined,
      field: undefined,
      details: undefined,
    });
    expect(error.stack).not.toContain('SERVER_STACK_MARKER');
    expect(error).not.toHaveProperty('sql');
    expect(error).not.toHaveProperty('prisma');
    expect(error).not.toHaveProperty('error');
  });

  it.each([
    { code: 'UNKNOWN_CODE', message: 'SQL secret', stack: 'secret stack' },
    {
      statusCode: 403,
      code: 'PRICING_FORBIDDEN',
      message: 'Mensagem interna.',
      stack: 'secret stack',
    },
    { code: 'PRICING_FORBIDDEN', message: 'Contrato incompleto.' },
    null,
  ])('uses a safe fallback for an invalid body', (body) => {
    const error = parseApiError(body, 500);

    expect(error.message).toBe('Não foi possível concluir a solicitação.');
    expect(error.code).toBeUndefined();
    expect(error.details).toBeUndefined();
    expect(JSON.stringify(error)).not.toContain('secret');
    expect(JSON.stringify(error)).not.toContain('interna');
    expect(JSON.stringify(error)).not.toContain('incompleto');
  });
});
