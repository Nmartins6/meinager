import {
  calculatePricing as calculatePricingFromPackage,
  PricingCalculatorError as PricingCalculatorErrorFromPackage,
  type PricingCalculatorInput,
  type PricingCalculatorResult,
} from '@meinager/pricing-calculator';

import { calculatePricing } from './pricing-calculator.js';
import { PricingCalculatorError } from './pricing-calculator.errors.js';

const input: PricingCalculatorInput = {
  currency: 'BRL',
  components: [
    {
      description: 'Custo direto',
      category: 'DIRECT_COST',
      unit: 'UN',
      quantity: '1',
      unitCost: '50',
      origin: 'MANUAL',
    },
  ],
  fixedCosts: { mode: 'RATE', rate: '0.1', origin: 'MANUAL' },
  deductions: [
    { name: 'Imposto', category: 'TAX', rate: '0.06', origin: 'MANUAL' },
    { name: 'Pagamento', category: 'PAYMENT', rate: '0.04', origin: 'MANUAL' },
  ],
  desiredMargin: '0.25',
};

describe('pricing calculator compatibility reexports', () => {
  it('reexports the same public function and typed error class', () => {
    expect(calculatePricing).toBe(calculatePricingFromPackage);
    expect(PricingCalculatorError).toBe(PricingCalculatorErrorFromPackage);
  });

  it('preserves the public types, formula version and a canonical result', () => {
    const result: PricingCalculatorResult = calculatePricing(input);

    expect(result.formulaVersion).toBe('margin-divisor-v1');
    expect(result.minimumPrice).toEqual({ exact: '62.5', commercial: '62.50' });
    expect(result.suggestedPrice.commercial).toBe('90.91');
  });

  it('preserves typed calculation errors through the legacy path', () => {
    expect(() => calculatePricing({ ...input, desiredMargin: '0.8' })).toThrow(
      expect.objectContaining({
        name: 'PricingCalculatorError',
        code: 'INVALID_PRICING_DIVISOR',
        field: 'divisor',
      }),
    );
  });
});
