import { pricingSimulationResponseFixture } from './pricing-simulation-test-fixtures';
import { createdPricingVersionSchema } from './pricing-versions-contracts';

const ids = {
  organization: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  product: '11111111-1111-4111-8111-111111111111',
  composition: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  configuration: '22222222-2222-4222-8222-222222222222',
  revision: '33333333-3333-4333-8333-333333333333',
  profile: '44444444-4444-4444-8444-444444444444',
  profileRevision: '55555555-5555-4555-8555-555555555555',
  component: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  deduction: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  version: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  user: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
};

export function pricingVersionFixture() {
  const simulated = pricingSimulationResponseFixture('0.00000001');
  const timestamp = '2026-10-26T12:00:00.000Z';
  const provenance = {
    source: null,
    referenceId: null,
    periodStart: null,
    periodEnd: null,
    criterion: null,
    measuredAt: null,
    confirmedByUserId: ids.user,
  };
  const componentOrigins = simulated.result.components.map((item, index) => ({
    schemaVersion: 1,
    position: index + 1,
    origin: item.origin,
    sourceProductId: item.productId ?? null,
    effectiveUnitCost: item.unitCost,
    ...provenance,
  }));
  const deductionOrigins = simulated.result.analysis.deductions.map((item, index) => ({
    schemaVersion: 1,
    position: index + 1,
    origin: item.origin,
    ...provenance,
  }));
  const snapshot = {
    snapshotSchemaVersion: 1,
    formulaVersion: simulated.formulaVersion,
    input: {
      currency: 'BRL',
      components: simulated.resolvedInput.components.map((item, index) => ({
        ...item,
        position: index + 1,
        productId: item.productId ?? null,
      })),
      labor: null,
      freight: null,
      fixedCosts: simulated.resolvedInput.fixedCosts ?? null,
      deductions: simulated.resolvedInput.deductions.map((item, index) => ({
        ...item,
        position: index + 1,
      })),
      desiredMargin: simulated.resolvedInput.desiredMargin,
      adoptedPrice: simulated.resolvedInput.adoptedPrice ?? null,
    },
    result: {
      ...simulated.result,
      components: simulated.result.components.map((item, index) => ({
        ...item,
        position: index + 1,
        productId: item.productId ?? null,
      })),
      deductions: simulated.result.deductions.map((item, index) => ({
        ...item,
        position: index + 1,
      })),
      labor: null,
      freight: null,
      analysis: {
        ...simulated.result.analysis,
        deductions: simulated.result.analysis.deductions.map((item, index) => ({
          ...item,
          position: index + 1,
        })),
      },
    },
    context: {
      organizationId: ids.organization,
      product: { id: ids.product, type: 'PRODUCT', name: 'Produto de teste', unit: 'UN' },
      composition: {
        id: ids.composition,
        revision: 3,
        parameterOrigins: [
          { schemaVersion: 1, parameter: 'desiredMargin', origin: 'MANUAL', ...provenance },
        ],
      },
      configuration: {
        id: ids.configuration,
        revisionId: ids.revision,
        revision: 3,
        effectiveFrom: timestamp,
        currency: 'BRL',
        fixedCosts: { mode: 'RATE', rate: '0.00000001' },
        monthlyLaborCost: null,
        productiveHours: null,
        defaultDesiredMargin: null,
        parameterOrigins: [],
      },
      salesProfile: {
        id: ids.profile,
        revisionId: ids.profileRevision,
        revision: 2,
        name: 'Varejo',
      },
      effectiveDesiredMargin: simulated.effectiveDesiredMargin,
      componentOrigins,
      deductionOrigins,
      calculatedAt: timestamp,
      calculatedByUserId: ids.user,
      decimalPolicy: {
        library: 'decimal.js',
        precision: 160,
        commercialRounding: 'ROUND_CEIL',
        informationalRounding: 'ROUND_HALF_UP',
      },
    },
  };
  return createdPricingVersionSchema.parse({
    id: ids.version,
    organizationId: ids.organization,
    productId: ids.product,
    number: 4,
    compositionId: ids.composition,
    compositionRevision: 3,
    configurationRevisionId: ids.revision,
    profileRevisionId: ids.profileRevision,
    state: 'FINALIZED',
    snapshot,
    minimumPriceCommercial: simulated.result.minimumPrice.commercial,
    suggestedPriceCommercial: simulated.result.suggestedPrice.commercial,
    analyzedPrice: simulated.result.analysis.price,
    classification: simulated.result.analysis.classification,
    componentCount: simulated.result.components.length,
    deductionCount: simulated.result.analysis.deductions.length,
    formulaVersion: simulated.formulaVersion,
    snapshotSchemaVersion: 1,
    currency: 'BRL',
    finalizedAt: timestamp,
    createdByUserId: ids.user,
    createdAt: timestamp,
    components: simulated.result.components.map((item, index) => ({
      id: ids.component,
      position: index + 1,
      description: item.description,
      category: item.category,
      unit: item.unit,
      quantity: item.quantity,
      effectiveUnitCost: item.unitCost,
      totalExact: item.total.exact,
      totalDisplay: item.total.display,
      sourceProductId: item.productId ?? null,
      costSource: item.origin,
      originDetails: componentOrigins[index],
      createdAt: timestamp,
    })),
    deductions: simulated.result.analysis.deductions.map((item, index) => ({
      id: ids.deduction,
      position: index + 1,
      name: item.name,
      category: item.category,
      rate: item.rate,
      amountExact: item.amount.exact,
      amountDisplay: item.amount.display,
      origin: item.origin,
      originDetails: deductionOrigins[index],
      createdAt: timestamp,
    })),
  });
}
