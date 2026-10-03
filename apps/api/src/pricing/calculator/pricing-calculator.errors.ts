export type PricingCalculatorErrorCode =
  | 'INVALID_PRICING_DIVISOR'
  | 'INVALID_AVERAGE_REVENUE'
  | 'INVALID_PRODUCTIVE_HOURS'
  | 'INVALID_FREIGHT_QUANTITY'
  | 'INVALID_DECIMAL_VALUE'
  | 'NEGATIVE_VALUE'
  | 'UNSUPPORTED_CURRENCY';

export class PricingCalculatorError extends Error {
  constructor(
    readonly code: PricingCalculatorErrorCode,
    readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = 'PricingCalculatorError';
  }
}
