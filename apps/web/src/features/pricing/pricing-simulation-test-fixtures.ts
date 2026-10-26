import { calculatePricing, type PricingCalculatorInput } from '@meinager/pricing-calculator';

import { pricingSimulationResponseSchema } from './pricing-simulation-contracts';

const productId = '11111111-1111-4111-8111-111111111111';
const sourceProductId = '66666666-6666-4666-8666-666666666666';

export function pricingSimulationResponseFixture(rate = '0.1') {
  const resolvedInput: PricingCalculatorInput = {
    currency: 'BRL',
    components: [
      {
        description: 'Material',
        category: 'MATERIAL',
        unit: 'KG',
        quantity: '2',
        unitCost: '12.5',
        origin: 'CATALOG',
        productId: sourceProductId,
      },
    ],
    fixedCosts: { mode: 'RATE', rate, origin: 'MANUAL' },
    deductions: [{ name: 'Imposto', category: 'TAX', rate: '0.06', origin: 'MANUAL' }],
    desiredMargin: '0.25',
    adoptedPrice: '88.5',
  };
  const result = calculatePricing(resolvedInput);
  return pricingSimulationResponseSchema.parse({
    productId,
    source: 'DRAFT' as const,
    compositionRevision: null,
    configuration: {
      id: '22222222-2222-4222-8222-222222222222',
      revisionId: '33333333-3333-4333-8333-333333333333',
      revision: 3,
    },
    profile: {
      id: '44444444-4444-4444-8444-444444444444',
      revisionId: '55555555-5555-4555-8555-555555555555',
      revision: 2,
      name: 'Varejo',
    },
    effectiveDesiredMargin: {
      value: '0.25',
      precedence: 'COMPOSITION' as const,
      origin: 'MANUAL' as const,
    },
    resolvedInput,
    result,
    formulaVersion: result.formulaVersion,
    adoptedPrice: result.adoptedPrice,
  });
}
