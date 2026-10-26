import { calculatePricing, type PricingCalculatorInput } from '@meinager/pricing-calculator';

import {
  draftPricingSimulationInputSchema,
  persistedPricingSimulationInputSchema,
  pricingSimulationResponseSchema,
} from './pricing-simulation-contracts';

const productId = '11111111-1111-4111-8111-111111111111';
const configurationId = '22222222-2222-4222-8222-222222222222';
const configurationRevisionId = '33333333-3333-4333-8333-333333333333';
const profileId = '44444444-4444-4444-8444-444444444444';
const profileRevisionId = '55555555-5555-4555-8555-555555555555';
const sourceProductId = '66666666-6666-4666-8666-666666666666';

const origin = { origin: 'MANUAL' as const };
const completeDraft = {
  profileId,
  desiredMargin: '0.25',
  laborEnabled: true,
  timeMinutes: '90',
  freightMode: 'ALLOCATED' as const,
  freightUnitCost: null,
  freightTotalCost: '120',
  freightQuantity: '40',
  freightConsumedQuantity: null,
  parameterOrigins: {
    desiredMargin: origin,
    laborEnabled: origin,
    timeMinutes: origin,
    freightMode: origin,
    freightTotalCost: origin,
    freightQuantity: origin,
  },
  components: [
    {
      description: 'Material',
      category: 'MATERIAL' as const,
      unit: 'KG',
      quantity: '2',
      costSource: 'CATALOG' as const,
      sourceProductId,
    },
    {
      description: 'Embalagem',
      category: 'PACKAGING' as const,
      unit: 'UN',
      quantity: '1',
      costSource: 'MANUAL' as const,
      storedUnitCost: '2',
    },
  ],
};

function responseFixture(rate = '0.1') {
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
  return {
    productId,
    source: 'DRAFT' as const,
    compositionRevision: null,
    configuration: { id: configurationId, revisionId: configurationRevisionId, revision: 3 },
    profile: {
      id: profileId,
      revisionId: profileRevisionId,
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
  };
}

describe('pricing simulation contracts', () => {
  it('accepts PERSISTED without draft and rejects a draft or unknown field', () => {
    expect(
      persistedPricingSimulationInputSchema.parse({ source: 'PERSISTED', adoptedPrice: '88.5' }),
    ).toEqual({ source: 'PERSISTED', adoptedPrice: '88.5' });
    expect(
      persistedPricingSimulationInputSchema.safeParse({ source: 'PERSISTED', draft: completeDraft })
        .success,
    ).toBe(false);
    expect(
      persistedPricingSimulationInputSchema.safeParse({ source: 'PERSISTED', snapshot: {} })
        .success,
    ).toBe(false);
  });

  it('accepts a complete ordered DRAFT without protected or resolved fields', () => {
    const parsed = draftPricingSimulationInputSchema.parse({
      source: 'DRAFT',
      draft: completeDraft,
      adoptedPrice: '88.5',
    });
    expect(parsed.draft.components.map((component) => component.description)).toEqual([
      'Material',
      'Embalagem',
    ]);
    expect(parsed.draft.components[0]).not.toHaveProperty('storedUnitCost');
    for (const field of [
      'expectedRevision',
      'position',
      'id',
      'organizationId',
      'formulaVersion',
      'classification',
      'effectiveUnitCost',
    ]) {
      expect(
        draftPricingSimulationInputSchema.safeParse({
          source: 'DRAFT',
          draft: { ...completeDraft, [field]: field === 'position' ? 1 : 'protected' },
        }).success,
      ).toBe(false);
    }
  });

  it('validates the complete authoritative response and preserves 0.00000001', () => {
    const parsed = pricingSimulationResponseSchema.parse(responseFixture('0.00000001'));
    expect(parsed.resolvedInput.fixedCosts).toEqual({
      mode: 'RATE',
      rate: '0.00000001',
      origin: 'MANUAL',
    });
    expect(JSON.stringify(parsed)).not.toContain('e-8');
  });

  it('requires the component and deduction arrays always returned by the API', () => {
    const response = responseFixture();
    const { components: _components, ...withoutComponents } = response.resolvedInput;
    const { deductions: _deductions, ...withoutDeductions } = response.resolvedInput;
    expect(
      pricingSimulationResponseSchema.safeParse({
        ...response,
        resolvedInput: withoutComponents,
      }).success,
    ).toBe(false);
    expect(
      pricingSimulationResponseSchema.safeParse({
        ...response,
        resolvedInput: withoutDeductions,
      }).success,
    ).toBe(false);
  });

  it.each([
    ['partial response', (value: ReturnType<typeof responseFixture>) => ({ ...value, result: {} })],
    [
      'noncanonical decimal',
      (value: ReturnType<typeof responseFixture>) => ({
        ...value,
        effectiveDesiredMargin: { ...value.effectiveDesiredMargin, value: '0.2500' },
      }),
    ],
    [
      'numeric financial value',
      (value: ReturnType<typeof responseFixture>) => ({
        ...value,
        effectiveDesiredMargin: { ...value.effectiveDesiredMargin, value: 0.25 },
      }),
    ],
    [
      'exponent',
      (value: ReturnType<typeof responseFixture>) => ({
        ...value,
        effectiveDesiredMargin: { ...value.effectiveDesiredMargin, value: '1e-8' },
      }),
    ],
    [
      'unknown field',
      (value: ReturnType<typeof responseFixture>) => ({ ...value, internalSql: 'secret' }),
    ],
  ])('rejects a response with %s', (_label, mutate) => {
    expect(pricingSimulationResponseSchema.safeParse(mutate(responseFixture())).success).toBe(
      false,
    );
  });
});
