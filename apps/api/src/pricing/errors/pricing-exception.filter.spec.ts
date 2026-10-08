import {
  BadRequestException,
  ForbiddenException,
  type ArgumentsHost,
} from '@nestjs/common';
import type { Response } from 'express';

import { PricingExceptionFilter } from './pricing-exception.filter.js';

describe('PricingExceptionFilter', () => {
  const status = vi.fn();
  const json = vi.fn();
  const response = { status, json } as unknown as Response;
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;

  beforeEach(() => {
    vi.resetAllMocks();
    status.mockReturnValue(response);
  });

  it('translates validation markers into stable field errors', () => {
    new PricingExceptionFilter().catch(
      new BadRequestException({
        message: ['__PRICING__|INVALID_DECIMAL_VALUE|fixedCostRate'],
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      code: 'INVALID_DECIMAL_VALUE',
      message: 'O valor decimal informado é inválido.',
      field: 'fixedCostRate',
    });
  });

  it('maps generic DTO validation without exposing validator details', () => {
    new PricingExceptionFilter().catch(
      new BadRequestException(['organizationId should not exist']),
      host,
    );

    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'A requisição de precificação é inválida.',
    });
  });

  it('maps authorization locally to the pricing contract', () => {
    new PricingExceptionFilter().catch(new ForbiddenException(), host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      statusCode: 403,
      code: 'PRICING_FORBIDDEN',
      message: 'Você não tem permissão para realizar esta ação.',
    });
  });

  it('does not expose unexpected SQL or Prisma details', () => {
    new PricingExceptionFilter().catch(
      new Error('P2004 constraint pricing_secret SQL failed'),
      host,
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Não foi possível concluir a operação de precificação.',
    });
    expect(JSON.stringify(json.mock.calls)).not.toMatch(/P2004|constraint|SQL/);
  });

  it('presents a generic P2028 as an internal error without Prisma details', () => {
    const failure = Object.assign(
      new Error('P2028 transaction closed while running secret SQL'),
      {
        code: 'P2028',
        meta: { sql: 'SELECT pricing_secret' },
      },
    );

    new PricingExceptionFilter().catch(failure, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Não foi possível concluir a operação de precificação.',
    });
    expect(JSON.stringify(json.mock.calls)).not.toMatch(
      /P2028|Prisma|stack|SQL|pricing_secret/,
    );
  });
});
