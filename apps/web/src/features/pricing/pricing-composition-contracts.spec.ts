import { describe, expect, it } from 'vitest';

import './pricing-composition-api.cases';
import './pricing-composition-form-state.cases';

import {
  pricingCompositionSchema,
  putPricingCompositionInputSchema,
} from './pricing-composition-contracts';

const productId = '11111111-1111-4111-8111-111111111111';
const sourceProductId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const timestamp = '2026-10-19T12:00:00.000Z';
const origin = {
  schemaVersion: 1,
  origin: 'MANUAL',
  source: null,
  referenceId: null,
  periodStart: null,
  periodEnd: null,
  criterion: null,
  measuredAt: null,
  confirmedByUserId: userId,
} as const;
const componentOrigin = {
  schemaVersion: 1,
  source: null,
  referenceId: null,
  periodStart: null,
  periodEnd: null,
  criterion: null,
  measuredAt: null,
  confirmedByUserId: userId,
} as const;

const composition = {
  id: '44444444-4444-4444-8444-444444444444',
  productId,
  revision: 2,
  profileId: null,
  desiredMargin: '0.25',
  laborEnabled: true,
  timeMinutes: '12.5',
  freightMode: 'ALLOCATED',
  freightUnitCost: null,
  freightTotalCost: '100',
  freightQuantity: '20',
  freightConsumedQuantity: '1',
  parameterOrigins: {
    desiredMargin: origin,
    laborEnabled: origin,
    timeMinutes: origin,
    freightMode: origin,
    freightTotalCost: origin,
    freightQuantity: origin,
    freightConsumedQuantity: origin,
  },
  isActive: true,
  createdAt: timestamp,
  updatedAt: timestamp,
  components: [
    {
      id: '55555555-5555-4555-8555-555555555555',
      position: 1,
      description: 'Insumo',
      category: 'MATERIAL',
      unit: 'KG',
      quantity: '0.000001',
      costSource: 'CATALOG',
      storedUnitCost: null,
      sourceProductId,
      originDetails: componentOrigin,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ],
} as const;

describe('pricing composition contracts', () => {
  it('accepts the exact canonical GET response', () => {
    expect(pricingCompositionSchema.parse(composition)).toEqual(composition);
  });

  it.each([
    { organizationId: productId },
    { components: [{ ...composition.components[0], position: 2 }] },
    { components: [{ ...composition.components[0], quantity: '1e-6' }] },
    { components: [{ ...composition.components[0], storedUnitCost: '10' }] },
    { components: [{ ...composition.components[0], sourceProductId: null }] },
    { parameterOrigins: [] },
    { parameterOrigins: { ...composition.parameterOrigins, freightUnitCost: origin } },
  ])('rejects an invalid GET response %#', (change) => {
    expect(pricingCompositionSchema.safeParse({ ...composition, ...change }).success).toBe(false);
  });

  it('accepts the exact PUT and keeps CATALOG free of stored cost', () => {
    const input = {
      expectedRevision: 2,
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
      components: [
        {
          description: 'Catálogo',
          category: 'MATERIAL',
          unit: 'UN',
          quantity: '1',
          costSource: 'CATALOG',
          sourceProductId,
          originDetails: {},
        },
      ],
    } as const;
    expect(putPricingCompositionInputSchema.parse(input)).toEqual(input);
  });

  it.each([
    { costSource: 'MANUAL', storedUnitCost: undefined, sourceProductId: null },
    { costSource: 'COPIED', storedUnitCost: null, sourceProductId: null },
    { costSource: 'MANUAL', storedUnitCost: '1', sourceProductId },
    { costSource: 'CATALOG', storedUnitCost: null, sourceProductId },
    { costSource: 'CATALOG', storedUnitCost: '1', sourceProductId },
    { costSource: 'CATALOG', storedUnitCost: undefined, sourceProductId: null },
  ])('rejects incompatible component origins %#', (fields) => {
    expect(
      putPricingCompositionInputSchema.safeParse({
        expectedRevision: null,
        profileId: null,
        desiredMargin: null,
        laborEnabled: false,
        timeMinutes: null,
        freightMode: null,
        freightUnitCost: null,
        freightTotalCost: null,
        freightQuantity: null,
        freightConsumedQuantity: null,
        parameterOrigins: {},
        components: [
          {
            description: 'Item',
            category: 'OTHER',
            unit: 'UN',
            quantity: '1',
            originDetails: {},
            ...fields,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('rejects protected properties in PUT components and origins', () => {
    const base = {
      expectedRevision: null,
      profileId: null,
      desiredMargin: null,
      laborEnabled: false,
      timeMinutes: null,
      freightMode: null,
      freightUnitCost: null,
      freightTotalCost: null,
      freightQuantity: null,
      freightConsumedQuantity: null,
      parameterOrigins: {},
      components: [],
    };
    expect(
      putPricingCompositionInputSchema.safeParse({ ...base, organizationId: productId }).success,
    ).toBe(false);
    expect(
      putPricingCompositionInputSchema.safeParse({
        ...base,
        components: [
          {
            id: crypto.randomUUID(),
            description: 'Item',
            category: 'OTHER',
            unit: 'UN',
            quantity: '1',
            costSource: 'MANUAL',
            storedUnitCost: '1',
          },
        ],
      }).success,
    ).toBe(false);
  });
});
