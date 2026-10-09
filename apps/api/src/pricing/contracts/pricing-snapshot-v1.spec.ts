import { calculatePricing } from '../calculator/pricing-calculator.js';
import {
  materializePricingSnapshotInputV1,
  materializePricingSnapshotResultV1,
  parsePricingSnapshotV1,
  replayPricingSnapshotV1,
  type PricingSnapshotV1,
} from './pricing-snapshot-v1.js';

const ids = {
  organization: '00000000-0000-4000-8000-000000000001',
  product: '00000000-0000-4000-8000-000000000002',
  composition: '00000000-0000-4000-8000-000000000003',
  configuration: '00000000-0000-4000-8000-000000000004',
  revision: '00000000-0000-4000-8000-000000000005',
  actor: '00000000-0000-4000-8000-000000000006',
};

function snapshot(): PricingSnapshotV1 {
  const calculatorInput = {
    currency: 'BRL' as const,
    components: [
      {
        description: 'Material',
        category: 'MATERIAL' as const,
        unit: 'UN',
        quantity: '1',
        unitCost: '0.000001',
        origin: 'MANUAL' as const,
      },
    ],
    desiredMargin: '0.00000001',
  };
  const input = materializePricingSnapshotInputV1(calculatorInput);
  const result = materializePricingSnapshotResultV1(
    calculatePricing(calculatorInput),
  );
  return {
    snapshotSchemaVersion: 1,
    formulaVersion: 'margin-divisor-v1',
    input,
    result,
    context: {
      organizationId: ids.organization,
      product: {
        id: ids.product,
        type: 'PRODUCT',
        name: 'Product',
        unit: 'UN',
      },
      composition: {
        id: ids.composition,
        revision: 1,
        parameterOrigins: [
          {
            schemaVersion: 1,
            parameter: 'desiredMargin',
            origin: 'MANUAL',
            source: null,
            referenceId: null,
            periodStart: null,
            periodEnd: null,
            criterion: null,
            measuredAt: null,
            confirmedByUserId: ids.actor,
          },
        ],
      },
      configuration: {
        id: ids.configuration,
        revisionId: ids.revision,
        revision: 1,
        effectiveFrom: '2026-10-08T12:00:00.000Z',
        currency: 'BRL',
        fixedCosts: null,
        monthlyLaborCost: null,
        productiveHours: null,
        defaultDesiredMargin: null,
        parameterOrigins: [],
      },
      salesProfile: null,
      effectiveDesiredMargin: {
        value: '0.00000001',
        origin: 'MANUAL',
        precedence: 'COMPOSITION',
      },
      componentOrigins: [
        {
          schemaVersion: 1,
          position: 1,
          origin: 'MANUAL',
          sourceProductId: null,
          effectiveUnitCost: '0.000001',
          source: null,
          referenceId: null,
          periodStart: null,
          periodEnd: null,
          criterion: null,
          measuredAt: null,
          confirmedByUserId: ids.actor,
        },
      ],
      deductionOrigins: [],
      calculatedAt: '2026-10-08T12:00:00.000Z',
      calculatedByUserId: ids.actor,
      decimalPolicy: {
        library: 'decimal.js',
        precision: 160,
        commercialRounding: 'ROUND_CEIL',
        informationalRounding: 'ROUND_HALF_UP',
      },
    },
  };
}

function clone(value: PricingSnapshotV1): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

describe('PricingSnapshotV1', () => {
  it('validates the exact contract, canonical tiny decimals and replay equality', () => {
    const value = snapshot();
    const parsed = parsePricingSnapshotV1(value);
    expect(parsed).toEqual(value);
    expect(replayPricingSnapshotV1(parsed)).toEqual(value.result);
    expect(JSON.stringify(parsed)).not.toMatch(/[eE]-8/);
  });

  it('materializes every optional calculator property as null', () => {
    const value = snapshot();
    expect(value.input).toMatchObject({
      labor: null,
      freight: null,
      fixedCosts: null,
      adoptedPrice: null,
    });
    expect(value.result).toMatchObject({
      labor: null,
      freight: null,
      adoptedPrice: null,
      maximumDiscountRate: expect.any(String),
    });
  });

  it.each([
    [
      'unknown snapshot version',
      (value: Record<string, unknown>) => (value.snapshotSchemaVersion = 2),
    ],
    [
      'unknown formula',
      (value: Record<string, unknown>) => (value.formulaVersion = 'future'),
    ],
    [
      'unknown property',
      (value: Record<string, unknown>) => (value.extra = true),
    ],
    [
      'exponential decimal',
      (value: Record<string, unknown>) =>
        ((
          (value.input as Record<string, unknown>).components as Record<
            string,
            unknown
          >[]
        )[0]!.unitCost = '1e-8'),
    ],
    [
      'missing nullable property',
      (value: Record<string, unknown>) =>
        delete (value.input as Record<string, unknown>).labor,
    ],
    [
      'noncontiguous position',
      (value: Record<string, unknown>) =>
        ((
          (value.input as Record<string, unknown>).components as Record<
            string,
            unknown
          >[]
        )[0]!.position = 2),
    ],
    [
      'missing component provenance',
      (value: Record<string, unknown>) =>
        (((value.context as Record<string, unknown>)
          .componentOrigins as unknown[]) = []),
    ],
    [
      'unknown parameter',
      (value: Record<string, unknown>) =>
        ((
          (
            (value.context as Record<string, unknown>).composition as Record<
              string,
              unknown
            >
          ).parameterOrigins as Record<string, unknown>[]
        )[0]!.parameter = 'unknown'),
    ],
  ])('rejects %s', (_label, mutate) => {
    const value = clone(snapshot());
    mutate(value);
    expect(() => parsePricingSnapshotV1(value)).toThrow();
  });

  it('rejects a result that does not match replay', () => {
    const value = clone(snapshot());
    (
      (value.result as Record<string, unknown>).analysis as Record<
        string,
        unknown
      >
    ).price = '1.00';
    expect(() => parsePricingSnapshotV1(value)).toThrow(/replay/);
  });

  it('accepts canonical negative fractions produced below the minimum', () => {
    const calculatorInput = {
      currency: 'BRL' as const,
      components: [
        {
          description: 'Material',
          category: 'MATERIAL' as const,
          unit: 'UN',
          quantity: '1',
          unitCost: '5',
          origin: 'MANUAL' as const,
        },
      ],
      fixedCosts: {
        mode: 'RATE' as const,
        rate: '0.1',
        origin: 'MANUAL' as const,
      },
      desiredMargin: '0.25',
      adoptedPrice: '5.50',
    };
    const base = snapshot();
    const value: PricingSnapshotV1 = {
      ...base,
      input: materializePricingSnapshotInputV1(calculatorInput),
      result: materializePricingSnapshotResultV1(
        calculatePricing(calculatorInput),
      ),
      context: {
        ...base.context,
        componentOrigins: [
          {
            ...base.context.componentOrigins[0]!,
            effectiveUnitCost: '5',
          },
        ],
        effectiveDesiredMargin: {
          ...base.context.effectiveDesiredMargin,
          value: '0.25',
        },
        configuration: {
          ...base.context.configuration,
          fixedCosts: { mode: 'RATE', rate: '0.1' },
        },
      },
    };
    expect(value.result.analysis.profit.exact).toMatch(/^-0\./);
    expect(value.result.analysis.profit.display).toMatch(/^-0\./);
    expect(parsePricingSnapshotV1(value)).toEqual(value);
  });
});
