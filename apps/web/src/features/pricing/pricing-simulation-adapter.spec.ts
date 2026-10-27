import type { Product } from '@/features/products/products-api';

import type { PricingComposition } from './pricing-composition-contracts';
import {
  pricingCompositionToFormValues,
  type PricingCompositionFormValues,
} from './pricing-composition-form-state';
import { buildLocalPricingPreview } from './pricing-preview-adapter';
import {
  buildPricingSimulationInput,
  hasAuthoritativePricingParity,
  hasAuthoritativeResolvedInputParity,
} from './pricing-simulation-adapter';
import { pricingSimulationResponseFixture } from './pricing-simulation-test-fixtures';

const productId = '11111111-1111-4111-8111-111111111111';
const componentAId = '22222222-2222-4222-8222-222222222222';
const componentBId = '33333333-3333-4333-8333-333333333333';
const userId = '44444444-4444-4444-8444-444444444444';
const timestamp = '2026-10-25T12:00:00.000Z';
const responseOrigin = {
  schemaVersion: 1 as const,
  origin: 'MANUAL' as const,
  source: null,
  referenceId: null,
  periodStart: null,
  periodEnd: null,
  criterion: null,
  measuredAt: null,
  confirmedByUserId: userId,
};
const product = { id: productId, salePrice: '88.5' } satisfies Pick<Product, 'id' | 'salePrice'>;
const composition: PricingComposition = {
  id: '55555555-5555-4555-8555-555555555555',
  productId,
  revision: 2,
  profileId: null,
  desiredMargin: '0.25',
  laborEnabled: false,
  timeMinutes: null,
  freightMode: null,
  freightUnitCost: null,
  freightTotalCost: null,
  freightQuantity: null,
  freightConsumedQuantity: null,
  parameterOrigins: { desiredMargin: responseOrigin, laborEnabled: responseOrigin },
  isActive: true,
  createdAt: timestamp,
  updatedAt: timestamp,
  components: [
    {
      id: componentAId,
      position: 1,
      description: 'Material',
      category: 'MATERIAL',
      unit: 'UN',
      quantity: '2',
      costSource: 'MANUAL',
      storedUnitCost: '12.5',
      sourceProductId: null,
      originDetails: { ...responseOrigin },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: componentBId,
      position: 2,
      description: 'Embalagem',
      category: 'PACKAGING',
      unit: 'UN',
      quantity: '1',
      costSource: 'COPIED',
      storedUnitCost: '2',
      sourceProductId: null,
      originDetails: { ...responseOrigin },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ],
};

function values(): PricingCompositionFormValues {
  return pricingCompositionToFormValues(composition);
}

describe('pricing simulation adapter', () => {
  it('matches the resolved inputs without relying on object key order and normalizes allocated freight', () => {
    const response = pricingSimulationResponseFixture();
    expect(hasAuthoritativeResolvedInputParity(response.resolvedInput, response)).toBe(true);
    expect(
      hasAuthoritativeResolvedInputParity(response.resolvedInput, {
        ...response,
        resolvedInput: {
          ...response.resolvedInput,
          components: [{ ...response.resolvedInput.components[0]!, quantity: '999' }],
        },
      }),
    ).toBe(false);
    const local = {
      ...response.resolvedInput,
      freight: { mode: 'ALLOCATED' as const, totalCost: '5', quantity: '10' },
    };
    expect(
      hasAuthoritativeResolvedInputParity(local, {
        ...response,
        resolvedInput: {
          ...local,
          freight: { ...local.freight, consumedQuantity: '1' },
        },
      }),
    ).toBe(true);
  });
  it('selects PERSISTED for an equivalent composition and includes the current price', () => {
    expect(buildPricingSimulationInput(values(), composition, product)).toEqual({
      source: 'PERSISTED',
      adoptedPrice: '88.5',
    });
  });

  it('omits adoptedPrice when salePrice is null', () => {
    expect(buildPricingSimulationInput(values(), composition, { salePrice: null })).toEqual({
      source: 'PERSISTED',
    });
  });

  it('uses DRAFT for a new or semantically changed composition', () => {
    const current = values();
    current.components[0]!.quantity = '3';
    expect(buildPricingSimulationInput(current, composition, product)).toMatchObject({
      source: 'DRAFT',
      draft: { components: [{ quantity: '3' }, { quantity: '1' }] },
    });
    expect(buildPricingSimulationInput(values(), null, product).source).toBe('DRAFT');
  });

  it('treats decimal-equivalent text as PERSISTED', () => {
    const current = values();
    current.components[0]!.quantity = '0002,000';
    current.components[0]!.storedUnitCost = '012.5000';
    expect(buildPricingSimulationInput(current, composition, product).source).toBe('PERSISTED');
  });

  it('uses DRAFT for provenance-only changes and component reordering', () => {
    const provenance = values();
    provenance.parameterOrigins.desiredMargin.source = 'Planilha revisada';
    expect(buildPricingSimulationInput(provenance, composition, product).source).toBe('DRAFT');

    const reordered = values();
    reordered.components.reverse();
    const input = buildPricingSimulationInput(reordered, composition, product);
    expect(input.source).toBe('DRAFT');
    if (input.source === 'DRAFT') {
      expect(input.draft.components.map((component) => component.description)).toEqual([
        'Embalagem',
        'Material',
      ]);
    }
  });

  it('never sends expectedRevision or storedUnitCost for CATALOG', () => {
    const current = values();
    current.components[0] = {
      ...current.components[0]!,
      costSource: 'CATALOG',
      storedUnitCost: '',
      sourceProductId: '66666666-6666-4666-8666-666666666666',
    };
    const input = buildPricingSimulationInput(current, composition, product);
    expect(input.source).toBe('DRAFT');
    expect(input).not.toHaveProperty('expectedRevision');
    if (input.source === 'DRAFT') {
      expect(input.draft).not.toHaveProperty('expectedRevision');
      expect(input.draft.components[0]).not.toHaveProperty('storedUnitCost');
    }
  });

  it('detects full result parity and an explicit divergence', () => {
    const response = pricingSimulationResponseFixture();
    expect(hasAuthoritativePricingParity(response.result, response)).toBe(true);
    expect(
      hasAuthoritativePricingParity(
        {
          ...response.result,
          analysis: { ...response.result.analysis, classification: 'COST_COVERAGE' },
        },
        response,
      ),
    ).toBe(false);
  });

  it('preserves allocated freight normalization when comparing results', () => {
    const current = pricingCompositionToFormValues(null);
    current.desiredMargin = '25';
    current.parameterOrigins.desiredMargin.origin = 'MANUAL';
    current.components = [values().components[0]!];
    current.freightMode = 'ALLOCATED';
    current.freightTotalCost = '120';
    current.freightQuantity = '40';
    const preview = buildLocalPricingPreview({
      product: { id: productId, salePrice: null },
      values: current,
      configuration: {
        id: '77777777-7777-4777-8777-777777777777',
        isActive: true,
        currentRevision: {
          id: '88888888-8888-4888-8888-888888888888',
          revision: 1,
          effectiveFrom: timestamp,
          currency: 'BRL',
          fixedCostMode: null,
          fixedCostRate: null,
          monthlyFixedCost: null,
          averageMonthlyRevenue: null,
          monthlyLaborCost: null,
          productiveHours: null,
          defaultDesiredMargin: null,
          parameterOrigins: {},
          createdAt: timestamp,
        },
      },
      profile: null,
      catalogProducts: [],
    });
    expect(preview).toMatchObject({
      status: 'available',
      result: { freight: { consumedQuantity: '1' } },
    });
  });
});
