import { describe, expect, it } from 'vitest';

import type { PricingComposition } from './pricing-composition-contracts';
import {
  buildPricingCompositionInput,
  createPricingCompositionFormSchema,
  pricingCompositionToFormValues,
} from './pricing-composition-form-state';

const productId = '11111111-1111-4111-8111-111111111111';
const sourceProductId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const timestamp = '2026-10-19T12:00:00.000Z';

const composition: PricingComposition = {
  id: '44444444-4444-4444-8444-444444444444',
  productId,
  revision: 3,
  profileId: null,
  desiredMargin: '0.25',
  laborEnabled: false,
  timeMinutes: null,
  freightMode: null,
  freightUnitCost: null,
  freightTotalCost: null,
  freightQuantity: null,
  freightConsumedQuantity: null,
  parameterOrigins: {},
  isActive: true,
  createdAt: timestamp,
  updatedAt: timestamp,
  components: [
    {
      id: '55555555-5555-4555-8555-555555555555',
      position: 1,
      description: 'Manual',
      category: 'MATERIAL',
      unit: 'UN',
      quantity: '1.5',
      costSource: 'MANUAL',
      storedUnitCost: '0.000001',
      sourceProductId: null,
      originDetails: {
        schemaVersion: 1,
        source: null,
        referenceId: null,
        periodStart: null,
        periodEnd: null,
        criterion: null,
        measuredAt: null,
        confirmedByUserId: userId,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ],
};

describe('pricing composition form state', () => {
  it('round-trips persisted decimals and detects a semantic no-op', () => {
    const values = pricingCompositionToFormValues(composition);
    const result = buildPricingCompositionInput(values, composition);
    expect(values.desiredMargin).toBe('25');
    expect(values.components[0]?.storedUnitCost).toBe('0.000001');
    expect(result.changed).toBe(false);
    expect(result.input.expectedRevision).toBe(3);
  });

  it('canonicalizes decimal text without floating-point conversion', () => {
    const values = pricingCompositionToFormValues(composition);
    values.desiredMargin = '025,0000';
    values.components[0]!.quantity = '0001,500000';
    values.components[0]!.storedUnitCost = '0,000001';
    const result = buildPricingCompositionInput(values, composition);
    expect(result.changed).toBe(false);
    expect(result.input.desiredMargin).toBe('0.25');
    expect(result.input.components[0]).toMatchObject({
      quantity: '1.5',
      storedUnitCost: '0.000001',
    });
  });

  it('serializes complete ordered replacement and omits protected fields', () => {
    const values = pricingCompositionToFormValues(composition);
    values.components.push({
      description: 'Catálogo',
      category: 'DIRECT_COST',
      unit: 'KG',
      quantity: '2',
      costSource: 'CATALOG',
      storedUnitCost: '999',
      sourceProductId,
      originDetails: {
        source: 'Cadastro',
        referenceId: '',
        periodStart: '',
        periodEnd: '',
        criterion: '',
        measuredAt: '',
      },
    });
    values.components.reverse();
    const { input, changed } = buildPricingCompositionInput(values, composition);
    expect(changed).toBe(true);
    expect(input.components.map((component) => component.description)).toEqual([
      'Catálogo',
      'Manual',
    ]);
    expect(input.components[0]).toEqual({
      description: 'Catálogo',
      category: 'DIRECT_COST',
      unit: 'KG',
      quantity: '2',
      costSource: 'CATALOG',
      sourceProductId,
      originDetails: {
        source: 'Cadastro',
        referenceId: null,
        periodStart: null,
        periodEnd: null,
        criterion: null,
        measuredAt: null,
      },
    });
    expect(input.components[0]).not.toHaveProperty('storedUnitCost');
    expect(input.components[0]).not.toHaveProperty('position');
    expect(input.components[0]).not.toHaveProperty('id');
  });

  it('represents removal as a complete replacement without the removed component', () => {
    const values = pricingCompositionToFormValues(composition);
    values.components.splice(0, 1);
    expect(buildPricingCompositionInput(values, composition)).toMatchObject({
      changed: true,
      input: { expectedRevision: 3, components: [] },
    });
  });

  it('serializes conditional labor, freight and applicable origins', () => {
    const values = pricingCompositionToFormValues(null);
    values.laborEnabled = true;
    values.timeMinutes = '030,00';
    values.freightMode = 'ALLOCATED';
    values.freightTotalCost = '100,00';
    values.freightQuantity = '20';
    values.freightConsumedQuantity = '1,5';
    values.parameterOrigins.timeMinutes.origin = 'MANUAL';
    values.parameterOrigins.timeMinutes.source = 'Cronometragem';
    values.parameterOrigins.freightUnitCost.origin = 'MANUAL';
    const { input } = buildPricingCompositionInput(values, null);
    expect(input).toMatchObject({
      expectedRevision: null,
      laborEnabled: true,
      timeMinutes: '30',
      freightMode: 'ALLOCATED',
      freightUnitCost: null,
      freightTotalCost: '100',
      freightQuantity: '20',
      freightConsumedQuantity: '1.5',
      parameterOrigins: {
        timeMinutes: {
          origin: 'MANUAL',
          source: 'Cronometragem',
        },
      },
    });
    expect(input.parameterOrigins).not.toHaveProperty('freightUnitCost');
  });

  it('rejects self-reference and invalid conditional component fields', () => {
    const schema = createPricingCompositionFormSchema(productId);
    const values = pricingCompositionToFormValues(null);
    values.components = [
      {
        description: 'Catálogo',
        category: 'MATERIAL',
        unit: 'UN',
        quantity: '1',
        costSource: 'CATALOG',
        storedUnitCost: '',
        sourceProductId: productId,
        originDetails: {
          source: '',
          referenceId: '',
          periodStart: '',
          periodEnd: '',
          criterion: '',
          measuredAt: '',
        },
      },
    ];
    expect(schema.safeParse(values).success).toBe(false);
    values.components[0]!.sourceProductId = 'not-a-uuid';
    const invalidUuid = schema.safeParse(values);
    expect(invalidUuid.success).toBe(false);
    if (!invalidUuid.success) {
      expect(invalidUuid.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['components', 0, 'sourceProductId'],
          message: 'Selecione um produto válido do catálogo.',
        }),
      );
    }
    values.components[0]!.costSource = 'MANUAL';
    values.components[0]!.sourceProductId = '';
    expect(schema.safeParse(values).success).toBe(false);
  });
});
