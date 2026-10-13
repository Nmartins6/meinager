import { Decimal } from 'decimal.js';

import { PricingCalculatorError } from './pricing-calculator.errors.js';

/** A fresh private constructor per call, independent of Decimal's global settings. */
export function createPricingDecimal() {
  const PricingDecimal = Decimal.clone({
    defaults: true,
    precision: 160,
    rounding: Decimal.ROUND_HALF_UP,
  });

  function readDecimal(
    value: string,
    field: string,
    kind: 'VALUE' | 'RATE' | 'PRICE' = 'VALUE',
  ): Decimal {
    if (typeof value !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(value)) {
      throw new PricingCalculatorError(
        'INVALID_DECIMAL_VALUE',
        field,
        'Informe um valor decimal finito usando ponto como separador.',
      );
    }
    const decimal = new PricingDecimal(value);
    if (decimal.isNegative() && !decimal.isZero()) {
      throw new PricingCalculatorError('NEGATIVE_VALUE', field, 'O valor não pode ser negativo.');
    }
    const integerDigits = value.replace(/^-?0*/, '').split('.')[0].length;
    const fractionDigits = value.split('.')[1]?.length ?? 0;
    const maxIntegerDigits = kind === 'RATE' ? 4 : 13;
    const maxFractionDigits = kind === 'RATE' ? 8 : kind === 'PRICE' ? 2 : 6;
    if (integerDigits > maxIntegerDigits || fractionDigits > maxFractionDigits) {
      throw new PricingCalculatorError(
        'INVALID_DECIMAL_VALUE',
        field,
        `Use até ${maxIntegerDigits} dígitos inteiros e ${maxFractionDigits} casas decimais.`,
      );
    }
    return decimal;
  }

  function decimalConstant(value: '0' | '1' | '60'): Decimal {
    return new PricingDecimal(value);
  }

  return { readDecimal, decimalConstant };
}

/** Fixed-point text without exponent notation or presentation rounding. */
export function decimalText(value: Decimal): string {
  return value.toFixed();
}
