import { describe, expect, it } from 'vitest';

import type { Product } from '@/features/products/products-api';

import type { PricingConfiguration } from './pricing-configuration-contracts';
import { pricingCompositionToFormValues } from './pricing-composition-form-state';
import {
  buildLocalPricingPreview,
  type PricingPreviewCatalogProduct,
} from './pricing-preview-adapter';
import type { PricingProfileDetail } from './pricing-profiles-contracts';

const productId = '11111111-1111-4111-8111-111111111111';
const sourceProductId = '22222222-2222-4222-8222-222222222222';
const profileId = '33333333-3333-4333-8333-333333333333';
const userId = '44444444-4444-4444-8444-444444444444';
const timestamp = '2026-10-20T12:00:00.000Z';

const product: Product = {
  id: productId,
  type: 'PRODUCT',
  name: 'Produto alvo',
  sku: null,
  barcode: null,
  unit: 'UN',
  directCost: '10',
  salePrice: null,
  trackInventory: false,
  minimumStock: null,
  notes: null,
  isActive: true,
  createdAt: timestamp,
  updatedAt: timestamp,
};

const origin = {
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

function configuration(
  overrides: Partial<PricingConfiguration['currentRevision']> = {},
): PricingConfiguration {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    isActive: true,
    currentRevision: {
      id: '66666666-6666-4666-8666-666666666666',
      revision: 1,
      effectiveFrom: timestamp,
      currency: 'BRL',
      fixedCostMode: 'RATE',
      fixedCostRate: '0.1',
      monthlyFixedCost: null,
      averageMonthlyRevenue: null,
      monthlyLaborCost: '3300',
      productiveHours: '165',
      defaultDesiredMargin: '0.25',
      parameterOrigins: {
        fixedCostRate: origin,
        defaultDesiredMargin: origin,
      },
      createdAt: timestamp,
      ...overrides,
    },
  };
}

function profile(
  deductions: PricingProfileDetail['currentRevision']['deductions'] = [],
  isActive = true,
): PricingProfileDetail {
  return {
    id: profileId,
    isActive,
    createdAt: timestamp,
    updatedAt: timestamp,
    currentRevision: {
      id: '77777777-7777-4777-8777-777777777777',
      revision: 1,
      name: 'Varejo',
      effectiveFrom: timestamp,
      createdAt: timestamp,
      deductions,
    },
  };
}

function deduction(name: string, category: string, rate: string, position: number) {
  return {
    id: `${position}8888888-8888-4888-8888-888888888888`,
    position,
    name,
    category,
    rate,
    origin: 'MANUAL' as const,
    originDetails: {
      schemaVersion: 1 as const,
      source: null,
      referenceId: null,
      periodStart: null,
      periodEnd: null,
      criterion: null,
      measuredAt: null,
      confirmedByUserId: userId,
    },
    createdAt: timestamp,
  };
}

function catalog(
  overrides: Partial<PricingPreviewCatalogProduct> = {},
): PricingPreviewCatalogProduct {
  return {
    id: sourceProductId,
    name: 'Material',
    unit: 'UN',
    directCost: '12.5',
    isActive: true,
    eligible: true,
    ...overrides,
  };
}

function manualComponent(unitCost: string, quantity = '1') {
  return {
    description: 'Custo direto',
    category: 'DIRECT_COST' as const,
    unit: 'UN',
    quantity,
    costSource: 'MANUAL' as const,
    storedUnitCost: unitCost,
    sourceProductId: '',
    originDetails: {
      source: '',
      referenceId: '',
      periodStart: '',
      periodEnd: '',
      criterion: '',
      measuredAt: '',
    },
  };
}

function calculate(options: Partial<Parameters<typeof buildLocalPricingPreview>[0]> = {}) {
  const values = pricingCompositionToFormValues(null);
  values.desiredMargin = '25';
  values.parameterOrigins.desiredMargin.origin = 'MANUAL';
  values.components = [manualComponent('50')];
  return buildLocalPricingPreview({
    product,
    values,
    configuration: configuration(),
    profile: null,
    catalogProducts: [],
    ...options,
  });
}

describe('local pricing preview adapter', () => {
  it('adapts a simple composition and uses the configuration margin fallback', () => {
    const values = pricingCompositionToFormValues(null);
    values.components = [manualComponent('50')];
    const preview = calculate({ values });
    expect(preview).toMatchObject({
      status: 'available',
      input: { desiredMargin: '0.25' },
      result: {
        formulaVersion: 'margin-divisor-v1',
        baseCost: { exact: '50', display: '50.00' },
      },
    });
  });

  it('blocks the configuration margin fallback when only its origin is missing', () => {
    const values = pricingCompositionToFormValues(null);
    values.components = [manualComponent('50')];
    const preview = calculate({
      values,
      configuration: configuration({
        parameterOrigins: { fixedCostRate: origin },
      }),
    });
    expect(preview).toEqual({
      status: 'missing-parameter',
      message: 'A margem padrão da configuração exige uma origem.',
      field: 'parameterOrigins.defaultDesiredMargin',
    });
    expect(preview).not.toHaveProperty('result');
  });

  it('gives the composition margin precedence without floating-point conversion', () => {
    const values = pricingCompositionToFormValues(null);
    values.desiredMargin = '30,000';
    values.parameterOrigins.desiredMargin.origin = 'COPIED';
    values.components = [manualComponent('50')];
    const preview = calculate({ values });
    expect(preview).toMatchObject({ status: 'available', input: { desiredMargin: '0.3' } });
  });

  it('blocks a composition margin without origin instead of falling back to configuration', () => {
    const values = pricingCompositionToFormValues(null);
    values.desiredMargin = '30';
    values.components = [manualComponent('50')];
    const preview = calculate({ values });
    expect(preview).toEqual({
      status: 'incomplete-draft',
      message: 'Informe a origem da margem desejada da composição para atualizar a prévia.',
      field: 'parameterOrigins.desiredMargin',
    });
    expect(preview).not.toHaveProperty('result');
  });

  it('maps MANUAL, COPIED and live CATALOG costs without using storedUnitCost as a cache', () => {
    const values = pricingCompositionToFormValues(null);
    values.components = [
      manualComponent('2'),
      { ...manualComponent('1.5'), description: 'Copiado', costSource: 'COPIED' },
      {
        ...manualComponent('999', '2'),
        description: 'Catálogo',
        costSource: 'CATALOG',
        storedUnitCost: '999',
        sourceProductId,
      },
    ];
    const preview = calculate({ values, catalogProducts: [catalog()] });
    expect(preview.status).toBe('available');
    if (preview.status !== 'available') return;
    expect(preview.input.components).toEqual([
      expect.objectContaining({ origin: 'MANUAL', unitCost: '2' }),
      expect.objectContaining({ origin: 'COPIED', unitCost: '1.5' }),
      expect.objectContaining({ origin: 'CATALOG', unitCost: '12.5', productId: sourceProductId }),
    ]);
    expect(preview.input.components?.[2]).not.toHaveProperty('storedUnitCost');
  });

  it.each([
    ['inactive', catalog({ isActive: false })],
    ['costless', catalog({ directCost: undefined })],
    ['unit mismatch', catalog({ unit: 'KG' })],
  ])('blocks an incompatible %s catalog product', (_label, source) => {
    const values = pricingCompositionToFormValues(null);
    values.components = [{ ...manualComponent('', '1'), costSource: 'CATALOG', sourceProductId }];
    expect(calculate({ values, catalogProducts: [source] })).toMatchObject({
      status: 'catalog-incompatible',
      field: expect.stringContaining('components.0'),
    });
  });

  it('blocks self-reference and a catalog reference absent from resolved products', () => {
    const values = pricingCompositionToFormValues(null);
    values.components = [
      { ...manualComponent('', '1'), costSource: 'CATALOG', sourceProductId: productId },
    ];
    expect(calculate({ values })).toMatchObject({ status: 'catalog-incompatible' });
    values.components[0]!.sourceProductId = sourceProductId;
    expect(calculate({ values })).toMatchObject({ status: 'catalog-incompatible' });
  });

  it('maps RATE and MONTHLY fixed costs with the required origin', () => {
    expect(calculate()).toMatchObject({
      status: 'available',
      input: { fixedCosts: { mode: 'RATE', rate: '0.1', origin: 'MANUAL' } },
    });
    const monthly = configuration({
      fixedCostMode: 'MONTHLY',
      fixedCostRate: null,
      monthlyFixedCost: '3000',
      averageMonthlyRevenue: '15000',
      parameterOrigins: {
        monthlyFixedCost: origin,
        defaultDesiredMargin: origin,
      },
    });
    expect(calculate({ configuration: monthly })).toMatchObject({
      status: 'available',
      input: {
        fixedCosts: {
          mode: 'MONTHLY',
          monthlyCost: '3000',
          averageRevenue: '15000',
          origin: 'MANUAL',
        },
      },
    });
  });

  it('does not invent a missing fixed-cost value or origin', () => {
    expect(calculate({ configuration: configuration({ fixedCostRate: null }) })).toMatchObject({
      status: 'missing-parameter',
      field: 'fixedCostRate',
    });
    expect(
      calculate({
        configuration: configuration({
          parameterOrigins: { defaultDesiredMargin: origin },
        }),
      }),
    ).toMatchObject({
      status: 'missing-parameter',
      field: 'parameterOrigins.fixedCostRate',
    });
  });

  it('maps enabled labor and omits it when disabled', () => {
    const disabled = calculate();
    expect(disabled.status).toBe('available');
    if (disabled.status !== 'available') return;
    expect(disabled.input).not.toHaveProperty('labor');

    const values = pricingCompositionToFormValues(null);
    values.desiredMargin = '25';
    values.parameterOrigins.desiredMargin.origin = 'MANUAL';
    values.components = [manualComponent('50')];
    values.laborEnabled = true;
    values.timeMinutes = '90';
    expect(calculate({ values })).toMatchObject({
      status: 'available',
      input: {
        labor: { monthlyCost: '3300', productiveHours: '165', timeMinutes: '90' },
      },
    });
  });

  it('maps absent, manual and allocated freight and lets the motor default consumedQuantity', () => {
    const absent = calculate();
    expect(absent.status).toBe('available');
    if (absent.status !== 'available') return;
    expect(absent.input).not.toHaveProperty('freight');

    const manualValues = pricingCompositionToFormValues(null);
    manualValues.components = [manualComponent('50')];
    manualValues.freightMode = 'MANUAL';
    manualValues.freightUnitCost = '3,5';
    expect(calculate({ values: manualValues })).toMatchObject({
      status: 'available',
      input: { freight: { mode: 'MANUAL', unitCost: '3.5' } },
    });

    const allocatedValues = pricingCompositionToFormValues(null);
    allocatedValues.components = [manualComponent('50')];
    allocatedValues.freightMode = 'ALLOCATED';
    allocatedValues.freightTotalCost = '120';
    allocatedValues.freightQuantity = '40';
    const allocated = calculate({ values: allocatedValues });
    expect(allocated).toMatchObject({
      status: 'available',
      input: { freight: { mode: 'ALLOCATED', totalCost: '120', quantity: '40' } },
      result: { freight: { consumedQuantity: '1', total: { exact: '3' } } },
    });
    if (allocated.status === 'available') {
      expect(allocated.input.freight).not.toHaveProperty('consumedQuantity');
    }
  });

  it('returns the typed freight error when the allocation quantity is zero', () => {
    const values = pricingCompositionToFormValues(null);
    values.components = [manualComponent('50')];
    values.freightMode = 'ALLOCATED';
    values.freightTotalCost = '120';
    values.freightQuantity = '0';
    expect(calculate({ values })).toMatchObject({
      status: 'calculator-error',
      code: 'INVALID_FREIGHT_QUANTITY',
      field: 'freight.quantity',
    });
  });

  it('uses no deductions for a null profile and preserves deduction order from its detail', () => {
    const withoutProfile = calculate();
    expect(withoutProfile).toMatchObject({ status: 'available', input: { deductions: [] } });
    const values = pricingCompositionToFormValues(null);
    values.profileId = profileId;
    values.components = [manualComponent('50')];
    const withProfile = calculate({
      values,
      profile: profile([
        deduction('Imposto', 'TAX', '0.06', 1),
        deduction('Pagamento', 'PAYMENT', '0.04', 2),
      ]),
    });
    expect(withProfile).toMatchObject({
      status: 'available',
      input: { deductions: [{ name: 'Imposto' }, { name: 'Pagamento' }] },
    });
  });

  it('blocks an inactive selected profile', () => {
    const values = pricingCompositionToFormValues(null);
    values.profileId = profileId;
    values.components = [manualComponent('50')];
    expect(calculate({ values, profile: profile([], false) })).toMatchObject({
      status: 'profile-inactive',
      field: 'profileId',
    });
  });

  it('uses the current product price only as informative adoptedPrice', () => {
    expect(calculate()).toMatchObject({
      status: 'available',
      input: expect.not.objectContaining({ adoptedPrice: expect.anything() }),
    });
    expect(calculate({ product: { ...product, salePrice: '80' } })).toMatchObject({
      status: 'available',
      input: { adoptedPrice: '80' },
      result: { adoptedPrice: '80.00' },
    });
  });

  it('preserves the smallest persisted decimal without exponent notation', () => {
    const preview = calculate({
      configuration: configuration({ fixedCostRate: '0.00000001' }),
    });
    expect(preview).toMatchObject({
      status: 'available',
      input: { fixedCosts: { rate: '0.00000001' } },
      result: { fixedCosts: { rate: '0.00000001' } },
    });
  });

  it('returns a typed calculator error for an invalid divisor and never exposes a stale result', () => {
    const values = pricingCompositionToFormValues(null);
    values.desiredMargin = '70';
    values.parameterOrigins.desiredMargin.origin = 'MANUAL';
    values.profileId = profileId;
    values.components = [manualComponent('50')];
    expect(
      calculate({
        values,
        profile: profile([deduction('Deduções', 'OTHER', '0.2', 1)]),
      }),
    ).toEqual({
      status: 'calculator-error',
      code: 'INVALID_PRICING_DIVISOR',
      field: 'divisor',
      message:
        'A soma dos percentuais de custos, taxas e margem deve ser menor que 100%. Revise os valores para calcular um preço válido.',
    });
  });

  it('returns an incomplete state when a valid financial field becomes blank', () => {
    const values = pricingCompositionToFormValues(null);
    values.components = [manualComponent('')];
    expect(calculate({ values })).toMatchObject({
      status: 'incomplete-draft',
      field: 'components.0.storedUnitCost',
    });
  });

  it('reproduces EX-001 through the web adapter', () => {
    const values = pricingCompositionToFormValues(null);
    values.profileId = profileId;
    values.components = [manualComponent('50')];
    const preview = calculate({
      values,
      profile: profile([
        deduction('Imposto', 'TAX', '0.06', 1),
        deduction('Pagamento', 'PAYMENT', '0.04', 2),
      ]),
    });
    expect(preview).toMatchObject({
      status: 'available',
      result: {
        formulaVersion: 'margin-divisor-v1',
        minimumPrice: { commercial: '62.50' },
        suggestedPrice: { commercial: '90.91' },
        analysis: { profit: { exact: '22.728', display: '22.73' } },
      },
    });
  });

  it('reproduces EX-002 through the complete web adapter', () => {
    const values = pricingCompositionToFormValues(null);
    values.profileId = profileId;
    values.desiredMargin = '25';
    values.parameterOrigins.desiredMargin.origin = 'MANUAL';
    values.laborEnabled = true;
    values.timeMinutes = '90';
    values.freightMode = 'ALLOCATED';
    values.freightTotalCost = '120';
    values.freightQuantity = '40';
    values.components = [
      {
        ...manualComponent('', '2'),
        description: 'Material',
        category: 'MATERIAL',
        costSource: 'CATALOG',
        sourceProductId,
      },
      { ...manualComponent('2'), description: 'Embalagem', category: 'PACKAGING' },
      { ...manualComponent('1.5'), description: 'Perdas', category: 'LOSS' },
    ];
    const monthly = configuration({
      fixedCostMode: 'MONTHLY',
      fixedCostRate: null,
      monthlyFixedCost: '3000',
      averageMonthlyRevenue: '15000',
      parameterOrigins: {
        monthlyFixedCost: origin,
        defaultDesiredMargin: origin,
      },
    });
    const preview = calculate({
      values,
      configuration: monthly,
      profile: profile([
        deduction('Imposto', 'TAX', '0.06', 1),
        deduction('Pagamento', 'PAYMENT', '0.035', 2),
        deduction('Comissão', 'COMMISSION', '0.02', 3),
      ]),
      catalogProducts: [catalog()],
    });
    expect(preview).toMatchObject({
      status: 'available',
      result: {
        formulaVersion: 'margin-divisor-v1',
        baseCost: { exact: '61.5', display: '61.50' },
        minimumPrice: { commercial: '89.79' },
        suggestedPrice: { commercial: '141.38' },
        analysis: { profit: { exact: '35.3453' } },
      },
    });
  });

  it('adapts and calculates a representative complete draft in less than 100 ms', () => {
    const values = pricingCompositionToFormValues(null);
    values.components = Array.from({ length: 40 }, (_, index) =>
      manualComponent(index % 2 === 0 ? '12.5' : '0.000001', '2'),
    );
    const startedAt = performance.now();
    const preview = calculate({ values });
    const elapsed = performance.now() - startedAt;
    expect(preview.status).toBe('available');
    expect(elapsed).toBeLessThan(100);
  });
});
