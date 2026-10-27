import { z } from 'zod';

import { pricingParameterOriginSchema } from './pricing-configuration-contracts';
import { pricingComponentCategorySchema } from './pricing-composition-contracts';
import {
  pricingCommercialPriceStringSchema,
  pricingDecimalStringSchema,
} from './pricing-contracts';
import { pricingCalculatorResultSchema } from './pricing-simulation-contracts';

const uuid = z.string().uuid();
const timestamp = z.iso.datetime({ offset: true });
const positiveInteger = z.number().int().positive();
const decimal = pricingDecimalStringSchema;
const signedDecimal = z
  .string()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d*[1-9])?$|^-(?:0\.[0-9]*[1-9]|[1-9]\d*(?:\.[0-9]*[1-9])?)$/);
const displayDecimal = z.string().regex(/^-?(?:0|[1-9]\d*)\.\d{2}$/);
const commercialDecimal = z.string().regex(/^(?:0|[1-9]\d*)\.\d{2}$/);
const classification = z.enum([
  'BELOW_MINIMUM',
  'COST_COVERAGE',
  'BELOW_DESIRED_MARGIN',
  'DESIRED_MARGIN_MET',
  'ABOVE_DESIRED_MARGIN',
]);
const componentOrigin = z.enum(['MANUAL', 'COPIED', 'CATALOG']);
const parameterName = z.enum([
  'fixedCostMode',
  'fixedCostRate',
  'monthlyFixedCost',
  'averageMonthlyRevenue',
  'monthlyLaborCost',
  'productiveHours',
  'defaultDesiredMargin',
  'desiredMargin',
  'laborEnabled',
  'timeMinutes',
  'freightMode',
  'freightUnitCost',
  'freightTotalCost',
  'freightQuantity',
  'freightConsumedQuantity',
]);

const provenanceDetails = {
  source: z.string().nullable(),
  referenceId: z.string().nullable(),
  periodStart: timestamp.nullable(),
  periodEnd: timestamp.nullable(),
  criterion: z.string().nullable(),
  measuredAt: timestamp.nullable(),
  confirmedByUserId: uuid.nullable(),
};
const parameterProvenance = z.strictObject({
  schemaVersion: z.literal(1),
  parameter: parameterName,
  origin: pricingParameterOriginSchema,
  ...provenanceDetails,
});
const componentProvenance = z.strictObject({
  schemaVersion: z.literal(1),
  position: positiveInteger,
  origin: componentOrigin,
  sourceProductId: uuid.nullable(),
  effectiveUnitCost: decimal,
  ...provenanceDetails,
});
const deductionProvenance = z.strictObject({
  schemaVersion: z.literal(1),
  position: positiveInteger,
  origin: pricingParameterOriginSchema,
  ...provenanceDetails,
});

const componentInput = z.strictObject({
  position: positiveInteger,
  description: z.string(),
  category: pricingComponentCategorySchema,
  unit: z.string(),
  quantity: decimal,
  unitCost: decimal,
  origin: componentOrigin,
  productId: uuid.nullable(),
});
const deductionInput = z.strictObject({
  position: positiveInteger,
  name: z.string(),
  category: z.string(),
  rate: decimal,
  origin: pricingParameterOriginSchema,
});
const fixedCosts = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('RATE'), rate: decimal, origin: pricingParameterOriginSchema }),
  z.strictObject({
    mode: z.literal('MONTHLY'),
    monthlyCost: decimal,
    averageRevenue: decimal,
    origin: pricingParameterOriginSchema,
  }),
]);
const freightInput = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('MANUAL'), unitCost: decimal }),
  z.strictObject({
    mode: z.literal('ALLOCATED'),
    totalCost: decimal,
    quantity: decimal,
    consumedQuantity: decimal.nullable(),
  }),
]);
const snapshotInput = z.strictObject({
  currency: z.literal('BRL'),
  components: z.array(componentInput),
  labor: z
    .strictObject({ monthlyCost: decimal, productiveHours: decimal, timeMinutes: decimal })
    .nullable(),
  freight: freightInput.nullable(),
  fixedCosts: fixedCosts.nullable(),
  deductions: z.array(deductionInput),
  desiredMargin: decimal,
  adoptedPrice: pricingCommercialPriceStringSchema.nullable(),
});
const money = z.strictObject({ exact: signedDecimal, display: displayDecimal });
const resultComponent = componentInput.extend({ total: money });
const resultDeduction = deductionInput.extend({ amount: money });
const freightResult = z.discriminatedUnion('mode', [
  z.strictObject({
    mode: z.literal('MANUAL'),
    unitCost: decimal,
    costPerLotUnit: money,
    total: money,
  }),
  z.strictObject({
    mode: z.literal('ALLOCATED'),
    totalCost: decimal,
    quantity: decimal,
    consumedQuantity: decimal,
    costPerLotUnit: money,
    total: money,
  }),
]);
const snapshotResult = z.strictObject({
  ...pricingCalculatorResultSchema.shape,
  components: z.array(resultComponent),
  deductions: z.array(deductionInput),
  labor: z
    .strictObject({
      monthlyCost: decimal,
      productiveHours: decimal,
      timeMinutes: decimal,
      costPerHour: money,
      costPerMinute: money,
      total: money,
    })
    .nullable(),
  freight: freightResult.nullable(),
  fixedCosts: z.strictObject({ input: fixedCosts.nullable(), rate: decimal }),
  analysis: z.strictObject({
    ...pricingCalculatorResultSchema.shape.analysis.shape,
    deductions: z.array(resultDeduction),
  }),
});

export const pricingSnapshotV1Schema = z.strictObject({
  snapshotSchemaVersion: z.literal(1),
  formulaVersion: z.literal('margin-divisor-v1'),
  input: snapshotInput,
  result: snapshotResult,
  context: z.strictObject({
    organizationId: uuid,
    product: z.strictObject({
      id: uuid,
      type: z.enum(['PRODUCT', 'SERVICE']),
      name: z.string(),
      unit: z.string(),
    }),
    composition: z.strictObject({
      id: uuid,
      revision: positiveInteger,
      parameterOrigins: z.array(parameterProvenance),
    }),
    configuration: z.strictObject({
      id: uuid,
      revisionId: uuid,
      revision: positiveInteger,
      effectiveFrom: timestamp,
      currency: z.literal('BRL'),
      fixedCosts: z
        .discriminatedUnion('mode', [
          z.strictObject({ mode: z.literal('RATE'), rate: decimal }),
          z.strictObject({
            mode: z.literal('MONTHLY'),
            monthlyCost: decimal,
            averageRevenue: decimal,
          }),
        ])
        .nullable(),
      monthlyLaborCost: decimal.nullable(),
      productiveHours: decimal.nullable(),
      defaultDesiredMargin: decimal.nullable(),
      parameterOrigins: z.array(parameterProvenance),
    }),
    salesProfile: z
      .strictObject({ id: uuid, revisionId: uuid, revision: positiveInteger, name: z.string() })
      .nullable(),
    effectiveDesiredMargin: z.strictObject({
      value: decimal,
      origin: pricingParameterOriginSchema,
      precedence: z.enum(['COMPOSITION', 'CONFIGURATION']),
    }),
    componentOrigins: z.array(componentProvenance),
    deductionOrigins: z.array(deductionProvenance),
    calculatedAt: timestamp,
    calculatedByUserId: uuid,
    decimalPolicy: z.strictObject({
      library: z.literal('decimal.js'),
      precision: z.literal(160),
      commercialRounding: z.literal('ROUND_CEIL'),
      informationalRounding: z.literal('ROUND_HALF_UP'),
    }),
  }),
});

export const createPricingVersionInputSchema = z.strictObject({
  expectedCompositionRevision: positiveInteger,
  adoptedPrice: pricingCommercialPriceStringSchema.optional(),
});
const versionBase = z.strictObject({
  id: uuid,
  organizationId: uuid,
  productId: uuid,
  number: positiveInteger,
  compositionId: uuid,
  compositionRevision: positiveInteger,
  configurationRevisionId: uuid,
  profileRevisionId: uuid.nullable(),
  state: z.literal('FINALIZED'),
  snapshot: pricingSnapshotV1Schema,
  minimumPriceCommercial: commercialDecimal,
  suggestedPriceCommercial: commercialDecimal,
  analyzedPrice: commercialDecimal,
  classification,
  componentCount: z.number().int().nonnegative(),
  deductionCount: z.number().int().nonnegative(),
  formulaVersion: z.literal('margin-divisor-v1'),
  snapshotSchemaVersion: z.literal(1),
  currency: z.literal('BRL'),
  finalizedAt: timestamp,
  createdByUserId: uuid,
  createdAt: timestamp,
  components: z.array(
    z.strictObject({
      id: uuid,
      position: positiveInteger,
      description: z.string(),
      category: pricingComponentCategorySchema,
      unit: z.string(),
      quantity: decimal,
      effectiveUnitCost: decimal,
      totalExact: signedDecimal,
      totalDisplay: displayDecimal,
      sourceProductId: uuid.nullable(),
      costSource: componentOrigin,
      originDetails: componentProvenance,
      createdAt: timestamp,
    }),
  ),
  deductions: z.array(
    z.strictObject({
      id: uuid,
      position: positiveInteger,
      name: z.string(),
      category: z.string(),
      rate: decimal,
      amountExact: signedDecimal,
      amountDisplay: displayDecimal,
      origin: pricingParameterOriginSchema,
      originDetails: deductionProvenance,
      createdAt: timestamp,
    }),
  ),
});
function checkVersion(value: z.infer<typeof versionBase>, context: z.RefinementCtx) {
  const snapshot = value.snapshot;
  const sameFields = (left: object, right: object) =>
    JSON.stringify(Object.entries(left).sort(([a], [b]) => a.localeCompare(b))) ===
    JSON.stringify(Object.entries(right).sort(([a], [b]) => a.localeCompare(b)));
  const ordered = (items: ReadonlyArray<{ position: number }>) =>
    items.every((item, index) => item.position === index + 1);
  const uniqueParameters = (items: ReadonlyArray<{ parameter: string }>) =>
    new Set(items.map((item) => item.parameter)).size === items.length;
  const orderedParameters = (items: ReadonlyArray<{ parameter: string }>) =>
    items.every((item, index) => index === 0 || items[index - 1]!.parameter < item.parameter);
  const valid =
    value.organizationId === snapshot.context.organizationId &&
    value.productId === snapshot.context.product.id &&
    value.compositionId === snapshot.context.composition.id &&
    value.compositionRevision === snapshot.context.composition.revision &&
    value.configurationRevisionId === snapshot.context.configuration.revisionId &&
    value.profileRevisionId === (snapshot.context.salesProfile?.revisionId ?? null) &&
    value.componentCount === value.components.length &&
    value.deductionCount === value.deductions.length &&
    value.componentCount === snapshot.result.components.length &&
    value.deductionCount === snapshot.result.analysis.deductions.length &&
    value.componentCount === snapshot.input.components.length &&
    value.deductionCount === snapshot.input.deductions.length &&
    value.componentCount === snapshot.context.componentOrigins.length &&
    value.deductionCount === snapshot.context.deductionOrigins.length &&
    uniqueParameters(snapshot.context.composition.parameterOrigins) &&
    uniqueParameters(snapshot.context.configuration.parameterOrigins) &&
    orderedParameters(snapshot.context.composition.parameterOrigins) &&
    orderedParameters(snapshot.context.configuration.parameterOrigins) &&
    value.formulaVersion === snapshot.formulaVersion &&
    value.snapshotSchemaVersion === snapshot.snapshotSchemaVersion &&
    snapshot.result.currency === snapshot.input.currency &&
    snapshot.context.configuration.currency === snapshot.input.currency &&
    snapshot.context.effectiveDesiredMargin.value === snapshot.input.desiredMargin &&
    value.classification === snapshot.result.analysis.classification &&
    value.minimumPriceCommercial === snapshot.result.minimumPrice.commercial &&
    value.suggestedPriceCommercial === snapshot.result.suggestedPrice.commercial &&
    value.analyzedPrice === snapshot.result.analysis.price &&
    ordered(snapshot.input.components) &&
    ordered(snapshot.input.deductions) &&
    ordered(snapshot.result.components) &&
    ordered(snapshot.result.deductions) &&
    ordered(snapshot.result.analysis.deductions) &&
    ordered(snapshot.context.componentOrigins) &&
    ordered(snapshot.context.deductionOrigins) &&
    ordered(value.components) &&
    ordered(value.deductions) &&
    snapshot.input.components.every((item, index) => {
      const result = snapshot.result.components[index];
      const origin = snapshot.context.componentOrigins[index];
      return (
        result?.position === item.position &&
        result.description === item.description &&
        result.category === item.category &&
        result.unit === item.unit &&
        result.quantity === item.quantity &&
        result.unitCost === item.unitCost &&
        result.origin === item.origin &&
        result.productId === item.productId &&
        origin?.origin === item.origin &&
        origin.sourceProductId === item.productId &&
        origin.effectiveUnitCost === item.unitCost &&
        (origin.origin === 'CATALOG') === (origin.sourceProductId !== null)
      );
    }) &&
    snapshot.input.deductions.every((item, index) => {
      const result = snapshot.result.analysis.deductions[index];
      const origin = snapshot.context.deductionOrigins[index];
      return (
        result?.position === item.position &&
        result.name === item.name &&
        result.category === item.category &&
        result.rate === item.rate &&
        result.origin === item.origin &&
        origin?.origin === item.origin
      );
    }) &&
    value.components.every(
      (item, index) =>
        item.position === snapshot.result.components[index]?.position &&
        item.description === snapshot.result.components[index]?.description &&
        item.category === snapshot.result.components[index]?.category &&
        item.unit === snapshot.result.components[index]?.unit &&
        item.quantity === snapshot.result.components[index]?.quantity &&
        item.effectiveUnitCost === snapshot.result.components[index]?.unitCost &&
        item.totalExact === snapshot.result.components[index]?.total.exact &&
        item.totalDisplay === snapshot.result.components[index]?.total.display &&
        item.sourceProductId === snapshot.result.components[index]?.productId &&
        item.costSource === snapshot.result.components[index]?.origin &&
        sameFields(item.originDetails, snapshot.context.componentOrigins[index]!) &&
        item.originDetails.position === item.position &&
        item.originDetails.effectiveUnitCost === item.effectiveUnitCost &&
        item.originDetails.sourceProductId === item.sourceProductId,
    ) &&
    value.deductions.every(
      (item, index) =>
        item.position === snapshot.result.analysis.deductions[index]?.position &&
        item.name === snapshot.result.analysis.deductions[index]?.name &&
        item.category === snapshot.result.analysis.deductions[index]?.category &&
        item.rate === snapshot.result.analysis.deductions[index]?.rate &&
        item.amountExact === snapshot.result.analysis.deductions[index]?.amount.exact &&
        item.amountDisplay === snapshot.result.analysis.deductions[index]?.amount.display &&
        item.origin === snapshot.result.analysis.deductions[index]?.origin &&
        sameFields(item.originDetails, snapshot.context.deductionOrigins[index]!) &&
        item.originDetails.position === item.position,
    );
  if (!valid)
    context.addIssue({ code: 'custom', message: 'A versão e o snapshot histórico divergem.' });
}
export const createdPricingVersionSchema = versionBase.superRefine(checkVersion);
export const pricingVersionDetailSchema = versionBase
  .extend({ isAdopted: z.boolean() })
  .superRefine(checkVersion);
const listItem = z.strictObject({
  id: uuid,
  number: positiveInteger,
  compositionRevision: positiveInteger,
  minimumPriceCommercial: commercialDecimal,
  suggestedPriceCommercial: commercialDecimal,
  analyzedPrice: commercialDecimal,
  classification,
  formulaVersion: z.literal('margin-divisor-v1'),
  snapshotSchemaVersion: z.literal(1),
  currency: z.literal('BRL'),
  finalizedAt: timestamp,
  createdByUserId: uuid,
  createdAt: timestamp,
  isAdopted: z.boolean(),
});
export const pricingVersionListSchema = z.strictObject({
  data: z.array(listItem),
  pagination: z.strictObject({
    page: positiveInteger,
    pageSize: positiveInteger,
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});
export type CreatePricingVersionInput = z.infer<typeof createPricingVersionInputSchema>;
export type CreatedPricingVersion = z.infer<typeof createdPricingVersionSchema>;
export type PricingVersionDetail = z.infer<typeof pricingVersionDetailSchema>;
export type PricingVersionList = z.infer<typeof pricingVersionListSchema>;
