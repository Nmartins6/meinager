import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  UnauthorizedException,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';

import {
  PricingErrorCode,
  PricingHttpException,
  type PricingErrorResponse,
} from './pricing-http.exception.js';

const VALIDATION_MARKER = '__PRICING__';

@Catch()
export class PricingExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PricingExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof PricingHttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    if (exception instanceof UnauthorizedException) {
      this.send(response, HttpStatus.UNAUTHORIZED, {
        code: PricingErrorCode.AUTHENTICATION_REQUIRED,
        message: 'Sessão inválida ou expirada.',
      });
      return;
    }

    if (exception instanceof ForbiddenException) {
      this.send(response, HttpStatus.FORBIDDEN, {
        code: PricingErrorCode.PRICING_FORBIDDEN,
        message: 'Você não tem permissão para realizar esta ação.',
      });
      return;
    }

    if (exception instanceof BadRequestException) {
      const marker = this.findValidationMarker(exception);
      if (marker) {
        this.send(response, HttpStatus.BAD_REQUEST, marker);
        return;
      }

      this.send(response, HttpStatus.BAD_REQUEST, {
        code: PricingErrorCode.VALIDATION_ERROR,
        message: 'A requisição de precificação é inválida.',
      });
      return;
    }

    this.logger.error(
      'Unexpected pricing request failure',
      exception instanceof Error ? exception.stack : undefined,
    );
    this.send(response, HttpStatus.INTERNAL_SERVER_ERROR, {
      code: PricingErrorCode.INTERNAL_ERROR,
      message: 'Não foi possível concluir a operação de precificação.',
    });
  }

  private findValidationMarker(exception: HttpException): {
    code: PricingErrorCode;
    message: string;
    field?: string;
  } | null {
    const body = exception.getResponse();
    if (typeof body !== 'object' || body === null || !('message' in body)) {
      return null;
    }

    const messages = Array.isArray(body.message)
      ? body.message
      : [body.message];

    for (const value of messages) {
      if (typeof value !== 'string' || !value.startsWith(VALIDATION_MARKER)) {
        continue;
      }

      const [, code, field] = value.split('|');
      if (!code || !this.isPricingErrorCode(code)) {
        continue;
      }

      return {
        code,
        message: this.validationMessage(code),
        ...(field ? { field } : {}),
      };
    }

    return null;
  }

  private isPricingErrorCode(value: string): value is PricingErrorCode {
    return Object.values(PricingErrorCode).some((code) => code === value);
  }

  private validationMessage(code: PricingErrorCode): string {
    switch (code) {
      case PricingErrorCode.INVALID_DECIMAL_VALUE:
        return 'O valor decimal informado é inválido.';
      case PricingErrorCode.NEGATIVE_VALUE:
        return 'O valor informado não pode ser negativo.';
      case PricingErrorCode.UNSUPPORTED_CURRENCY:
        return 'A moeda informada não é suportada.';
      default:
        return 'A requisição de precificação é inválida.';
    }
  }

  private send(
    response: Response,
    statusCode: HttpStatus,
    error: Omit<PricingErrorResponse, 'statusCode'>,
  ): void {
    response.status(statusCode).json({ statusCode, ...error });
  }
}
