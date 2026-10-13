import { describe, expect, it } from 'vitest';

import { ApiError, parseApiError } from './api';

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
