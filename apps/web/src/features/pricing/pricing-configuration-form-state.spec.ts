import { describe, expect, it } from 'vitest';

import type { PricingConfiguration } from './pricing-configuration-contracts';
import {
  buildPricingConfigurationPatch,
  pricingConfigurationFormSchema,
  pricingConfigurationToFormValues,
} from './pricing-configuration-form-state';

const origin = {
  schemaVersion: 1 as const,
  origin: 'MANUAL' as const,
  source: null,
  referenceId: null,
  periodStart: null,
  periodEnd: null,
  criterion: null,
  measuredAt: null,
  confirmedByUserId: '53a6ba71-77b9-4aca-9493-e08e7dd11b83',
};

const emptyOriginInput = {
  origin: 'MANUAL' as const,
  source: null,
  referenceId: null,
  periodStart: null,
  periodEnd: null,
  criterion: null,
  measuredAt: null,
};

const configuration: PricingConfiguration = {
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
};

describe('pricing configuration form state', () => {
  it('converts stored fractions to exact human percentages', () => {
    const values = pricingConfigurationToFormValues(configuration);
    expect(values.fixedCostRate).toBe('12.5');
    expect(values.defaultDesiredMargin).toBe('25');
  });

  it('builds a partial PATCH with only the changed value and its origin', () => {
    const values = pricingConfigurationToFormValues(configuration);
    values.defaultDesiredMargin = '30,00';
    values.origins.defaultDesiredMargin.origin = 'FINANCIAL_AGGREGATE';
    values.origins.defaultDesiredMargin.source = 'DRE gerencial';

    expect(buildPricingConfigurationPatch(values, configuration)).toEqual({
      changed: true,
      input: {
        expectedRevision: 2,
        defaultDesiredMargin: '0.3',
        parameterOrigins: {
          defaultDesiredMargin: {
            origin: 'FINANCIAL_AGGREGATE',
            source: 'DRE gerencial',
            referenceId: null,
            periodStart: null,
            periodEnd: null,
            criterion: null,
            measuredAt: null,
          },
        },
      },
    });
  });

  it('sends only the provenance when only its origin changes', () => {
    const values = pricingConfigurationToFormValues(configuration);
    values.fixedCostRate = '012,5000';
    values.origins.fixedCostRate.origin = 'COPIED';

    expect(buildPricingConfigurationPatch(values, configuration)).toEqual({
      changed: true,
      input: {
        expectedRevision: 2,
        parameterOrigins: {
          fixedCostRate: { ...emptyOriginInput, origin: 'COPIED' },
        },
      },
    });
  });

  it('sends only the provenance when only source changes', () => {
    const values = pricingConfigurationToFormValues(configuration);
    values.origins.fixedCostRate.source = 'Apuração gerencial';

    expect(buildPricingConfigurationPatch(values, configuration)).toEqual({
      changed: true,
      input: {
        expectedRevision: 2,
        parameterOrigins: {
          fixedCostRate: {
            ...emptyOriginInput,
            source: 'Apuração gerencial',
          },
        },
      },
    });
  });

  it('sends null to clear a persisted source without sending protected confirmation', () => {
    const configurationWithSource: PricingConfiguration = {
      ...configuration,
      currentRevision: {
        ...configuration.currentRevision,
        parameterOrigins: {
          ...configuration.currentRevision.parameterOrigins,
          fixedCostRate: { ...origin, source: 'ERP' },
        },
      },
    };
    const values = pricingConfigurationToFormValues(configurationWithSource);
    values.origins.fixedCostRate.source = '';

    const result = buildPricingConfigurationPatch(values, configurationWithSource);
    expect(result).toEqual({
      changed: true,
      input: {
        expectedRevision: 2,
        parameterOrigins: {
          fixedCostRate: emptyOriginInput,
        },
      },
    });
    expect(result.input.parameterOrigins?.fixedCostRate).not.toHaveProperty('confirmedByUserId');
    expect(result.input.parameterOrigins?.fixedCostRate).not.toHaveProperty('schemaVersion');
  });

  it('treats an identical provenance and an equivalent decimal representation as no-op', () => {
    const values = pricingConfigurationToFormValues(configuration);
    values.fixedCostRate = '012,5000';

    expect(buildPricingConfigurationPatch(values, configuration)).toEqual({
      changed: false,
      input: { expectedRevision: 2 },
    });
  });

  it('applies exact RATE to MONTHLY removal semantics', () => {
    const values = pricingConfigurationToFormValues(configuration);
    values.fixedCostMode = 'MONTHLY';
    values.monthlyFixedCost = '1000';
    values.averageMonthlyRevenue = '5000';

    expect(buildPricingConfigurationPatch(values, configuration).input).toEqual({
      expectedRevision: 2,
      fixedCostMode: 'MONTHLY',
      fixedCostRate: null,
      monthlyFixedCost: '1000',
      averageMonthlyRevenue: '5000',
      parameterOrigins: {
        fixedCostMode: emptyOriginInput,
        monthlyFixedCost: emptyOriginInput,
        averageMonthlyRevenue: emptyOriginInput,
      },
    });
    expect(
      buildPricingConfigurationPatch(values, configuration).input.parameterOrigins,
    ).not.toHaveProperty('fixedCostRate');
  });

  it('creates with expectedRevision null and no protected fields', () => {
    const values = pricingConfigurationToFormValues(null);
    values.fixedCostMode = 'RATE';
    values.fixedCostRate = '12,5';

    expect(buildPricingConfigurationPatch(values, null)).toEqual({
      changed: true,
      input: {
        expectedRevision: null,
        currency: 'BRL',
        fixedCostMode: 'RATE',
        fixedCostRate: '0.125',
        parameterOrigins: {
          fixedCostMode: emptyOriginInput,
          fixedCostRate: emptyOriginInput,
        },
      },
    });
  });

  it('validates conditional fixed costs, labor pairs and decimal syntax', () => {
    const values = pricingConfigurationToFormValues(null);
    values.fixedCostMode = 'MONTHLY';
    values.monthlyFixedCost = '1000';
    values.averageMonthlyRevenue = '0';
    values.monthlyLaborCost = 'NaN';

    const parsed = pricingConfigurationFormSchema.safeParse(values);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.path.join('.'))).toEqual(
        expect.arrayContaining(['averageMonthlyRevenue', 'monthlyLaborCost', 'productiveHours']),
      );
    }
  });
});
