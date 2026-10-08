import { HttpException, type HttpStatus } from '@nestjs/common';

export const PricingErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_DECIMAL_VALUE: 'INVALID_DECIMAL_VALUE',
  NEGATIVE_VALUE: 'NEGATIVE_VALUE',
  UNSUPPORTED_CURRENCY: 'UNSUPPORTED_CURRENCY',
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  PRICING_FORBIDDEN: 'PRICING_FORBIDDEN',
  PRICING_CONFIGURATION_NOT_FOUND: 'PRICING_CONFIGURATION_NOT_FOUND',
  PRICING_CONFIGURATION_REQUIRED: 'PRICING_CONFIGURATION_REQUIRED',
  PRICING_PROFILE_NOT_FOUND: 'PRICING_PROFILE_NOT_FOUND',
  PRICING_PROFILE_INACTIVE: 'PRICING_PROFILE_INACTIVE',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  PRICING_COMPOSITION_NOT_FOUND: 'PRICING_COMPOSITION_NOT_FOUND',
  PRICING_REVISION_CONFLICT: 'PRICING_REVISION_CONFLICT',
  PRICING_CONCURRENT_MODIFICATION: 'PRICING_CONCURRENT_MODIFICATION',
  INVALID_AVERAGE_REVENUE: 'INVALID_AVERAGE_REVENUE',
  INVALID_PRODUCTIVE_HOURS: 'INVALID_PRODUCTIVE_HOURS',
  INVALID_FREIGHT_QUANTITY: 'INVALID_FREIGHT_QUANTITY',
  INVALID_PRICING_DIVISOR: 'INVALID_PRICING_DIVISOR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type PricingErrorCode =
  (typeof PricingErrorCode)[keyof typeof PricingErrorCode];

export interface PricingErrorResponse {
  statusCode: number;
  code: PricingErrorCode;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

export class PricingHttpException extends HttpException {
  constructor(
    status: HttpStatus,
    code: PricingErrorCode,
    message: string,
    options?: {
      field?: string;
      details?: Record<string, unknown>;
    },
  ) {
    const response: PricingErrorResponse = {
      statusCode: status,
      code,
      message,
      ...(options?.field ? { field: options.field } : {}),
      ...(options?.details ? { details: options.details } : {}),
    };

    super(response, status);
  }
}
