import { describe, expect, it } from 'vitest';

import {
  pricingConfigurationSchema,
  pricingParameterOriginInputSchema,
  updatePricingConfigurationInputSchema,
} from './pricing-configuration-contracts';

const origin = {
  schemaVersion: 1,
  origin: 'MANUAL',
  source: null,
  referenceId: null,
  periodStart: null,
  periodEnd: null,
  criterion: null,
  measuredAt: null,
  confirmedByUserId: '53a6ba71-77b9-4aca-9493-e08e7dd11b83',
} as const;

const configuration = {
  id: '7d9805c3-00ba-486e-a59b-188c72aa3551',
  isActive: true,
  currentRevision: {
    id: 'cf2c1950-fb93-4490-864a-99e02990f4f1',
    revision: 2,
    effectiveFrom: '2026-10-13T12:00:00.000Z',
    currency: 'BRL',
    fixedCostMode: 'RATE',
    fixedCostRate: '0.125',
    monthlyFixedCost: null,
    averageMonthlyRevenue: null,
    monthlyLaborCost: '1000',
    productiveHours: '160',
    defaultDesiredMargin: '0.25',
    parameterOrigins: {
      fixedCostMode: origin,
      fixedCostRate: origin,
      monthlyLaborCost: origin,
      productiveHours: origin,
      defaultDesiredMargin: origin,
    },
    createdAt: '2026-10-13T12:00:00.000Z',
  },
} as const;

describe('pricing configuration contracts', () => {
  it('accepts the exact GET response and rejects unknown or protected properties', () => {
    expect(pricingConfigurationSchema.parse(configuration)).toEqual(configuration);
    expect(
      pricingConfigurationSchema.safeParse({
        ...configuration,
        organizationId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
    expect(
      pricingConfigurationSchema.safeParse({
        ...configuration,
        currentRevision: { ...configuration.currentRevision, fixedCostRate: '1e-8' },
      }).success,
    ).toBe(false);
  });

  it('accepts the exact partial PATCH, including null removal and omitted fields', () => {
    expect(
      updatePricingConfigurationInputSchema.parse({
        expectedRevision: 2,
        defaultDesiredMargin: null,
      }),
    ).toEqual({ expectedRevision: 2, defaultDesiredMargin: null });
    expect(updatePricingConfigurationInputSchema.parse({ expectedRevision: null })).toEqual({
      expectedRevision: null,
    });
  });

  it.each([
    { expectedRevision: undefined },
    { expectedRevision: 0 },
    { expectedRevision: 2, organizationId: crypto.randomUUID() },
    { expectedRevision: 2, actorUserId: crypto.randomUUID() },
    { expectedRevision: 2, revision: 3 },
    { expectedRevision: 2, createdAt: '2026-10-13T12:00:00.000Z' },
    { expectedRevision: 2, confirmedByUserId: crypto.randomUUID() },
    { expectedRevision: 2, fixedCostRate: '01.00' },
    { expectedRevision: 2, fixedCostRate: '-1' },
    { expectedRevision: 2, fixedCostRate: '1e-8' },
    { expectedRevision: 2, monthlyFixedCost: '10000000000000' },
    { expectedRevision: 2, monthlyFixedCost: '1.0000001' },
  ])('rejects an invalid PATCH %#', (input) => {
    expect(updatePricingConfigurationInputSchema.safeParse(input).success).toBe(false);
  });

  it('matches nullable, omitted and empty origin metadata without accepting protected fields', () => {
    expect(pricingParameterOriginInputSchema.parse({ origin: 'MANUAL' })).toEqual({
      origin: 'MANUAL',
    });
    expect(pricingParameterOriginInputSchema.parse({ origin: 'COPIED', source: null })).toEqual({
      origin: 'COPIED',
      source: null,
    });
    expect(pricingParameterOriginInputSchema.parse({ origin: 'COPIED', source: '' })).toEqual({
      origin: 'COPIED',
      source: '',
    });
    expect(
      pricingParameterOriginInputSchema.parse({
        origin: 'FINANCIAL_AGGREGATE',
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30T23:59:59.999Z',
      }),
    ).toBeDefined();
    expect(
      pricingParameterOriginInputSchema.safeParse({
        origin: 'MANUAL',
        confirmedByUserId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });
});
