import { isDeepStrictEqual } from 'node:util';

import { calculatePricing } from '../calculator/pricing-calculator.js';
import type {
  DecimalString,
  PricingCalculatorInput,
  PricingCalculatorResult,
  PricingClassification,
  PricingComponentCategory,
  PricingParameterOrigin,
} from '../calculator/pricing-calculator.types.js';

export interface PricingMoneySnapshotV1 {
  readonly exact: DecimalString;
  readonly display: DecimalString;
}

export interface PricingPriceSnapshotV1 {
  readonly exact: DecimalString;
  readonly commercial: DecimalString;
}

export interface PricingComponentInputSnapshotV1 {
  readonly position: number;
  readonly description: string;
  readonly category: PricingComponentCategory;
  readonly unit: string;
  readonly quantity: DecimalString;
  readonly unitCost: DecimalString;
  readonly origin: 'MANUAL' | 'COPIED' | 'CATALOG';
  readonly productId: string | null;
}

export interface PricingDeductionInputSnapshotV1 {
  readonly position: number;
  readonly name: string;
  readonly category: string;
  readonly rate: DecimalString;
  readonly origin: PricingParameterOrigin;
}

export interface PricingLaborInputSnapshotV1 {
  readonly monthlyCost: DecimalString;
  readonly productiveHours: DecimalString;
  readonly timeMinutes: DecimalString;
}

export type PricingFreightInputSnapshotV1 =
  | { readonly mode: 'MANUAL'; readonly unitCost: DecimalString }
  | {
      readonly mode: 'ALLOCATED';
      readonly totalCost: DecimalString;
      readonly quantity: DecimalString;
      readonly consumedQuantity: DecimalString | null;
    };

export type PricingFreightResultSnapshotV1 =
  | {
      readonly mode: 'MANUAL';
      readonly unitCost: DecimalString;
      readonly costPerLotUnit: PricingMoneySnapshotV1;
      readonly total: PricingMoneySnapshotV1;
    }
  | {
      readonly mode: 'ALLOCATED';
      readonly totalCost: DecimalString;
      readonly quantity: DecimalString;
      readonly consumedQuantity: DecimalString;
      readonly costPerLotUnit: PricingMoneySnapshotV1;
      readonly total: PricingMoneySnapshotV1;
    };

export type PricingFixedCostsInputSnapshotV1 =
  | {
      readonly mode: 'RATE';
      readonly rate: DecimalString;
      readonly origin: PricingParameterOrigin;
    }
  | {
      readonly mode: 'MONTHLY';
      readonly monthlyCost: DecimalString;
      readonly averageRevenue: DecimalString;
      readonly origin: PricingParameterOrigin;
    };

export interface PricingCalculatorInputSnapshotV1 {
  readonly currency: 'BRL';
  readonly components: readonly PricingComponentInputSnapshotV1[];
  readonly labor: PricingLaborInputSnapshotV1 | null;
  readonly freight: PricingFreightInputSnapshotV1 | null;
  readonly fixedCosts: PricingFixedCostsInputSnapshotV1 | null;
  readonly deductions: readonly PricingDeductionInputSnapshotV1[];
  readonly desiredMargin: DecimalString;
  readonly adoptedPrice: DecimalString | null;
}

export interface PricingCalculatorResultSnapshotV1 {
  readonly formulaVersion: 'margin-divisor-v1';
  readonly currency: 'BRL';
  readonly components: readonly (PricingComponentInputSnapshotV1 & {
    readonly total: PricingMoneySnapshotV1;
  })[];
  readonly labor:
    | (PricingLaborInputSnapshotV1 & {
        readonly costPerHour: PricingMoneySnapshotV1;
        readonly costPerMinute: PricingMoneySnapshotV1;
        readonly total: PricingMoneySnapshotV1;
      })
    | null;
  readonly freight: PricingFreightResultSnapshotV1 | null;
  readonly fixedCosts: {
    readonly input: PricingFixedCostsInputSnapshotV1 | null;
    readonly rate: DecimalString;
  };
  readonly deductions: readonly PricingDeductionInputSnapshotV1[];
  readonly totalDeductionRate: DecimalString;
  readonly desiredMargin: DecimalString;
  readonly baseCost: PricingMoneySnapshotV1;
  readonly minimumPrice: PricingPriceSnapshotV1;
  readonly suggestedPrice: PricingPriceSnapshotV1;
  readonly adoptedPrice: DecimalString | null;
  readonly analysis: {
    readonly price: DecimalString;
    readonly fixedCosts: PricingMoneySnapshotV1;
    readonly deductions: readonly (PricingDeductionInputSnapshotV1 & {
      readonly amount: PricingMoneySnapshotV1;
    })[];
    readonly totalDeductions: PricingMoneySnapshotV1;
    readonly profit: PricingMoneySnapshotV1;
    readonly effectiveMargin: DecimalString | null;
    readonly differenceFromSuggestedExact: PricingMoneySnapshotV1;
    readonly classification: PricingClassification;
  };
  readonly maximumDiscountRate: DecimalString | null;
  readonly warnings: readonly {
    readonly code: 'BELOW_MINIMUM' | 'BELOW_DESIRED_MARGIN';
    readonly message: string;
  }[];
}

export interface PricingProvenanceDetailsV1 {
  readonly source: string | null;
  readonly referenceId: string | null;
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly criterion: string | null;
  readonly measuredAt: string | null;
  readonly confirmedByUserId: string | null;
}

export const PRICING_PARAMETER_NAMES_V1 = [
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
] as const;

export type PricingParameterNameV1 =
  (typeof PRICING_PARAMETER_NAMES_V1)[number];

export interface PricingParameterProvenanceV1 extends PricingProvenanceDetailsV1 {
  readonly schemaVersion: 1;
  readonly parameter: PricingParameterNameV1;
  readonly origin: PricingParameterOrigin;
}

export interface PricingComponentProvenanceV1 extends PricingProvenanceDetailsV1 {
  readonly schemaVersion: 1;
  readonly position: number;
  readonly origin: 'MANUAL' | 'COPIED' | 'CATALOG';
  readonly sourceProductId: string | null;
  readonly effectiveUnitCost: DecimalString;
}

export interface PricingDeductionProvenanceV1 extends PricingProvenanceDetailsV1 {
  readonly schemaVersion: 1;
  readonly position: number;
  readonly origin: PricingParameterOrigin;
}

export interface PricingSnapshotV1 {
  readonly snapshotSchemaVersion: 1;
  readonly formulaVersion: 'margin-divisor-v1';
  readonly input: PricingCalculatorInputSnapshotV1;
  readonly result: PricingCalculatorResultSnapshotV1;
  readonly context: {
    readonly organizationId: string;
    readonly product: {
      readonly id: string;
      readonly type: string;
      readonly name: string;
      readonly unit: string;
    };
    readonly composition: {
      readonly id: string;
      readonly revision: number;
      readonly parameterOrigins: readonly PricingParameterProvenanceV1[];
    };
    readonly configuration: {
      readonly id: string;
      readonly revisionId: string;
      readonly revision: number;
      readonly effectiveFrom: string;
      readonly currency: 'BRL';
      readonly fixedCosts:
        | { readonly mode: 'RATE'; readonly rate: DecimalString }
        | {
            readonly mode: 'MONTHLY';
            readonly monthlyCost: DecimalString;
            readonly averageRevenue: DecimalString;
          }
        | null;
      readonly monthlyLaborCost: DecimalString | null;
      readonly productiveHours: DecimalString | null;
      readonly defaultDesiredMargin: DecimalString | null;
      readonly parameterOrigins: readonly PricingParameterProvenanceV1[];
    };
    readonly salesProfile: {
      readonly id: string;
      readonly revisionId: string;
      readonly revision: number;
      readonly name: string;
    } | null;
    readonly effectiveDesiredMargin: {
      readonly value: DecimalString;
      readonly origin: PricingParameterOrigin;
      readonly precedence: 'COMPOSITION' | 'CONFIGURATION';
    };
    readonly componentOrigins: readonly PricingComponentProvenanceV1[];
    readonly deductionOrigins: readonly PricingDeductionProvenanceV1[];
    readonly calculatedAt: string;
    readonly calculatedByUserId: string;
    readonly decimalPolicy: {
      readonly library: 'decimal.js';
      readonly precision: 160;
      readonly commercialRounding: 'ROUND_CEIL';
      readonly informationalRounding: 'ROUND_HALF_UP';
    };
  };
}

export class PricingSnapshotValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PricingSnapshotValidationError';
  }
}

const EXACT_DECIMAL = /^(?:0|-[1-9]\d*|[1-9]\d*)(?:\.\d*[1-9])?$/;
const DISPLAY_DECIMAL = /^(?:0|-[1-9]\d*|[1-9]\d*)\.\d{2}$/;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ORIGINS = ['MANUAL', 'FINANCIAL_AGGREGATE', 'COPIED'] as const;
const COMPONENT_ORIGINS = ['MANUAL', 'COPIED', 'CATALOG'] as const;
const COMPONENT_CATEGORIES = [
  'DIRECT_COST',
  'MATERIAL',
  'PACKAGING',
  'LABOR',
  'FREIGHT',
  'OUTSOURCING',
  'LOSS',
  'OTHER',
] as const;
const CLASSIFICATIONS = [
  'BELOW_MINIMUM',
  'COST_COVERAGE',
  'BELOW_DESIRED_MARGIN',
  'DESIRED_MARGIN_MET',
  'ABOVE_DESIRED_MARGIN',
] as const;

type RecordValue = Record<string, unknown>;

function fail(path: string, problem: string): never {
  throw new PricingSnapshotValidationError(`${path}: ${problem}`);
}

function record(
  value: unknown,
  path: string,
  keys: readonly string[],
): RecordValue {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    fail(path, 'deve ser um objeto');
  }
  const actual = Object.keys(value as RecordValue).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(path, 'possui propriedades ausentes ou desconhecidas');
  }
  return value as RecordValue;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'deve ser uma coleção');
  return value;
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'deve ser texto');
  return value;
}

function literal<T extends string | number>(
  value: unknown,
  expected: T,
  path: string,
): T {
  if (value !== expected) fail(path, `deve ser ${String(expected)}`);
  return expected;
}

function oneOf<T extends string>(
  value: unknown,
  values: readonly T[],
  path: string,
): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    fail(path, 'possui valor desconhecido');
  }
  return value as T;
}

function integer(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    fail(path, 'deve ser inteiro positivo');
  }
  return value;
}

function nullableString(value: unknown, path: string): string | null {
  return value === null ? null : string(value, path);
}

function decimal(value: unknown, path: string): DecimalString {
  const parsed = string(value, path);
  if (!EXACT_DECIMAL.test(parsed)) fail(path, 'decimal não canônico');
  return parsed;
}

function nullableDecimal(value: unknown, path: string): DecimalString | null {
  return value === null ? null : decimal(value, path);
}

function displayDecimal(value: unknown, path: string): DecimalString {
  const parsed = string(value, path);
  if (!DISPLAY_DECIMAL.test(parsed)) fail(path, 'decimal exibido não canônico');
  return parsed;
}

function nullableDisplayDecimal(
  value: unknown,
  path: string,
): DecimalString | null {
  return value === null ? null : displayDecimal(value, path);
}

function uuid(value: unknown, path: string): string {
  const parsed = string(value, path);
  if (!UUID_V4.test(parsed)) fail(path, 'UUID v4 não canônico');
  return parsed;
}

function nullableUuid(value: unknown, path: string): string | null {
  return value === null ? null : uuid(value, path);
}

function timestamp(value: unknown, path: string): string {
  const parsed = string(value, path);
  const date = new Date(parsed);
  if (Number.isNaN(date.valueOf()) || date.toISOString() !== parsed) {
    fail(path, 'timestamp UTC não canônico');
  }
  return parsed;
}

function nullableTimestamp(value: unknown, path: string): string | null {
  return value === null ? null : timestamp(value, path);
}

function money(value: unknown, path: string): PricingMoneySnapshotV1 {
  const item = record(value, path, ['exact', 'display']);
  return {
    exact: decimal(item.exact, `${path}.exact`),
    display: displayDecimal(item.display, `${path}.display`),
  };
}

function price(value: unknown, path: string): PricingPriceSnapshotV1 {
  const item = record(value, path, ['exact', 'commercial']);
  return {
    exact: decimal(item.exact, `${path}.exact`),
    commercial: displayDecimal(item.commercial, `${path}.commercial`),
  };
}

function component(
  value: unknown,
  path: string,
  withTotal: boolean,
): PricingComponentInputSnapshotV1 & {
  readonly total?: PricingMoneySnapshotV1;
} {
  const keys = [
    'position',
    'description',
    'category',
    'unit',
    'quantity',
    'unitCost',
    'origin',
    'productId',
    ...(withTotal ? ['total'] : []),
  ];
  const item = record(value, path, keys);
  const origin = oneOf(item.origin, COMPONENT_ORIGINS, `${path}.origin`);
  const productId = nullableUuid(item.productId, `${path}.productId`);
  if ((origin === 'CATALOG') !== (productId !== null)) {
    fail(path, 'origem e productId são incompatíveis');
  }
  return {
    position: integer(item.position, `${path}.position`),
    description: string(item.description, `${path}.description`),
    category: oneOf(item.category, COMPONENT_CATEGORIES, `${path}.category`),
    unit: string(item.unit, `${path}.unit`),
    quantity: decimal(item.quantity, `${path}.quantity`),
    unitCost: decimal(item.unitCost, `${path}.unitCost`),
    origin,
    productId,
    ...(withTotal ? { total: money(item.total, `${path}.total`) } : {}),
  };
}

function deduction(
  value: unknown,
  path: string,
  withAmount: boolean,
): PricingDeductionInputSnapshotV1 & {
  readonly amount?: PricingMoneySnapshotV1;
} {
  const item = record(value, path, [
    'position',
    'name',
    'category',
    'rate',
    'origin',
    ...(withAmount ? ['amount'] : []),
  ]);
  return {
    position: integer(item.position, `${path}.position`),
    name: string(item.name, `${path}.name`),
    category: string(item.category, `${path}.category`),
    rate: decimal(item.rate, `${path}.rate`),
    origin: oneOf(item.origin, ORIGINS, `${path}.origin`),
    ...(withAmount ? { amount: money(item.amount, `${path}.amount`) } : {}),
  };
}

function labor(value: unknown, path: string, withResult: boolean) {
  if (value === null) return null;
  const item = record(value, path, [
    'monthlyCost',
    'productiveHours',
    'timeMinutes',
    ...(withResult ? ['costPerHour', 'costPerMinute', 'total'] : []),
  ]);
  return {
    monthlyCost: decimal(item.monthlyCost, `${path}.monthlyCost`),
    productiveHours: decimal(item.productiveHours, `${path}.productiveHours`),
    timeMinutes: decimal(item.timeMinutes, `${path}.timeMinutes`),
    ...(withResult
      ? {
          costPerHour: money(item.costPerHour, `${path}.costPerHour`),
          costPerMinute: money(item.costPerMinute, `${path}.costPerMinute`),
          total: money(item.total, `${path}.total`),
        }
      : {}),
  };
}

function freight(value: unknown, path: string, withResult: boolean) {
  if (value === null) return null;
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    fail(path, 'deve ser objeto ou null');
  }
  const mode = (value as RecordValue).mode;
  if (mode === 'MANUAL') {
    const item = record(value, path, [
      'mode',
      'unitCost',
      ...(withResult ? ['costPerLotUnit', 'total'] : []),
    ]);
    return {
      mode: literal(item.mode, 'MANUAL', `${path}.mode`),
      unitCost: decimal(item.unitCost, `${path}.unitCost`),
      ...(withResult
        ? {
            costPerLotUnit: money(
              item.costPerLotUnit,
              `${path}.costPerLotUnit`,
            ),
            total: money(item.total, `${path}.total`),
          }
        : {}),
    };
  }
  const item = record(value, path, [
    'mode',
    'totalCost',
    'quantity',
    'consumedQuantity',
    ...(withResult ? ['costPerLotUnit', 'total'] : []),
  ]);
  return {
    mode: literal(item.mode, 'ALLOCATED', `${path}.mode`),
    totalCost: decimal(item.totalCost, `${path}.totalCost`),
    quantity: decimal(item.quantity, `${path}.quantity`),
    consumedQuantity: withResult
      ? decimal(item.consumedQuantity, `${path}.consumedQuantity`)
      : nullableDecimal(item.consumedQuantity, `${path}.consumedQuantity`),
    ...(withResult
      ? {
          costPerLotUnit: money(item.costPerLotUnit, `${path}.costPerLotUnit`),
          total: money(item.total, `${path}.total`),
        }
      : {}),
  };
}

function fixedCosts(value: unknown, path: string, includeOrigin: boolean) {
  if (value === null) return null;
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    fail(path, 'deve ser objeto ou null');
  }
  const mode = (value as RecordValue).mode;
  if (mode === 'RATE') {
    const item = record(value, path, [
      'mode',
      'rate',
      ...(includeOrigin ? ['origin'] : []),
    ]);
    return {
      mode: literal(item.mode, 'RATE', `${path}.mode`),
      rate: decimal(item.rate, `${path}.rate`),
      ...(includeOrigin
        ? { origin: oneOf(item.origin, ORIGINS, `${path}.origin`) }
        : {}),
    };
  }
  const item = record(value, path, [
    'mode',
    'monthlyCost',
    'averageRevenue',
    ...(includeOrigin ? ['origin'] : []),
  ]);
  return {
    mode: literal(item.mode, 'MONTHLY', `${path}.mode`),
    monthlyCost: decimal(item.monthlyCost, `${path}.monthlyCost`),
    averageRevenue: decimal(item.averageRevenue, `${path}.averageRevenue`),
    ...(includeOrigin
      ? { origin: oneOf(item.origin, ORIGINS, `${path}.origin`) }
      : {}),
  };
}

function assertPositions(items: readonly { position: number }[], path: string) {
  items.forEach((item, index) => {
    if (item.position !== index + 1) fail(path, 'posições devem ser contíguas');
  });
}

function parseInput(value: unknown): PricingCalculatorInputSnapshotV1 {
  const input = record(value, 'input', [
    'currency',
    'components',
    'labor',
    'freight',
    'fixedCosts',
    'deductions',
    'desiredMargin',
    'adoptedPrice',
  ]);
  const components = array(input.components, 'input.components').map(
    (item, index) => component(item, `input.components.${index}`, false),
  );
  const deductions = array(input.deductions, 'input.deductions').map(
    (item, index) => deduction(item, `input.deductions.${index}`, false),
  );
  assertPositions(components, 'input.components');
  assertPositions(deductions, 'input.deductions');
  return {
    currency: literal(input.currency, 'BRL', 'input.currency'),
    components,
    labor: labor(
      input.labor,
      'input.labor',
      false,
    ) as PricingLaborInputSnapshotV1 | null,
    freight: freight(
      input.freight,
      'input.freight',
      false,
    ) as PricingFreightInputSnapshotV1 | null,
    fixedCosts: fixedCosts(
      input.fixedCosts,
      'input.fixedCosts',
      true,
    ) as PricingFixedCostsInputSnapshotV1 | null,
    deductions,
    desiredMargin: decimal(input.desiredMargin, 'input.desiredMargin'),
    adoptedPrice: nullableDecimal(input.adoptedPrice, 'input.adoptedPrice'),
  };
}

function parseResult(value: unknown): PricingCalculatorResultSnapshotV1 {
  const result = record(value, 'result', [
    'formulaVersion',
    'currency',
    'components',
    'labor',
    'freight',
    'fixedCosts',
    'deductions',
    'totalDeductionRate',
    'desiredMargin',
    'baseCost',
    'minimumPrice',
    'suggestedPrice',
    'adoptedPrice',
    'analysis',
    'maximumDiscountRate',
    'warnings',
  ]);
  const components = array(result.components, 'result.components').map(
    (item, index) => component(item, `result.components.${index}`, true),
  ) as PricingCalculatorResultSnapshotV1['components'];
  const deductions = array(result.deductions, 'result.deductions').map(
    (item, index) => deduction(item, `result.deductions.${index}`, false),
  );
  assertPositions(components, 'result.components');
  assertPositions(deductions, 'result.deductions');
  const fixed = record(result.fixedCosts, 'result.fixedCosts', [
    'input',
    'rate',
  ]);
  const analysis = record(result.analysis, 'result.analysis', [
    'price',
    'fixedCosts',
    'deductions',
    'totalDeductions',
    'profit',
    'effectiveMargin',
    'differenceFromSuggestedExact',
    'classification',
  ]);
  const analysisDeductions = array(
    analysis.deductions,
    'result.analysis.deductions',
  ).map((item, index) =>
    deduction(item, `result.analysis.deductions.${index}`, true),
  ) as PricingCalculatorResultSnapshotV1['analysis']['deductions'];
  assertPositions(analysisDeductions, 'result.analysis.deductions');
  const warnings = array(result.warnings, 'result.warnings').map(
    (value, index) => {
      const item = record(value, `result.warnings.${index}`, [
        'code',
        'message',
      ]);
      return {
        code: oneOf(
          item.code,
          ['BELOW_MINIMUM', 'BELOW_DESIRED_MARGIN'] as const,
          `result.warnings.${index}.code`,
        ),
        message: string(item.message, `result.warnings.${index}.message`),
      };
    },
  );
  return {
    formulaVersion: literal(
      result.formulaVersion,
      'margin-divisor-v1',
      'result.formulaVersion',
    ),
    currency: literal(result.currency, 'BRL', 'result.currency'),
    components,
    labor: labor(
      result.labor,
      'result.labor',
      true,
    ) as PricingCalculatorResultSnapshotV1['labor'],
    freight: freight(
      result.freight,
      'result.freight',
      true,
    ) as PricingFreightResultSnapshotV1 | null,
    fixedCosts: {
      input: fixedCosts(
        fixed.input,
        'result.fixedCosts.input',
        true,
      ) as PricingFixedCostsInputSnapshotV1 | null,
      rate: decimal(fixed.rate, 'result.fixedCosts.rate'),
    },
    deductions,
    totalDeductionRate: decimal(
      result.totalDeductionRate,
      'result.totalDeductionRate',
    ),
    desiredMargin: decimal(result.desiredMargin, 'result.desiredMargin'),
    baseCost: money(result.baseCost, 'result.baseCost'),
    minimumPrice: price(result.minimumPrice, 'result.minimumPrice'),
    suggestedPrice: price(result.suggestedPrice, 'result.suggestedPrice'),
    adoptedPrice: nullableDisplayDecimal(
      result.adoptedPrice,
      'result.adoptedPrice',
    ),
    analysis: {
      price: displayDecimal(analysis.price, 'result.analysis.price'),
      fixedCosts: money(analysis.fixedCosts, 'result.analysis.fixedCosts'),
      deductions: analysisDeductions,
      totalDeductions: money(
        analysis.totalDeductions,
        'result.analysis.totalDeductions',
      ),
      profit: money(analysis.profit, 'result.analysis.profit'),
      effectiveMargin: nullableDecimal(
        analysis.effectiveMargin,
        'result.analysis.effectiveMargin',
      ),
      differenceFromSuggestedExact: money(
        analysis.differenceFromSuggestedExact,
        'result.analysis.differenceFromSuggestedExact',
      ),
      classification: oneOf(
        analysis.classification,
        CLASSIFICATIONS,
        'result.analysis.classification',
      ),
    },
    maximumDiscountRate: nullableDecimal(
      result.maximumDiscountRate,
      'result.maximumDiscountRate',
    ),
    warnings,
  };
}

const PROVENANCE_KEYS = [
  'source',
  'referenceId',
  'periodStart',
  'periodEnd',
  'criterion',
  'measuredAt',
  'confirmedByUserId',
] as const;

function provenanceDetails(
  item: RecordValue,
  path: string,
): PricingProvenanceDetailsV1 {
  return {
    source: nullableString(item.source, `${path}.source`),
    referenceId: nullableString(item.referenceId, `${path}.referenceId`),
    periodStart: nullableTimestamp(item.periodStart, `${path}.periodStart`),
    periodEnd: nullableTimestamp(item.periodEnd, `${path}.periodEnd`),
    criterion: nullableString(item.criterion, `${path}.criterion`),
    measuredAt: nullableTimestamp(item.measuredAt, `${path}.measuredAt`),
    confirmedByUserId: nullableUuid(
      item.confirmedByUserId,
      `${path}.confirmedByUserId`,
    ),
  };
}

function parameterOrigins(
  value: unknown,
  path: string,
): PricingParameterProvenanceV1[] {
  const seen = new Set<string>();
  const parsed = array(value, path).map((value, index) => {
    const itemPath = `${path}.${index}`;
    const item = record(value, itemPath, [
      'schemaVersion',
      'parameter',
      'origin',
      ...PROVENANCE_KEYS,
    ]);
    const parameter = oneOf(
      item.parameter,
      PRICING_PARAMETER_NAMES_V1,
      `${itemPath}.parameter`,
    );
    if (seen.has(parameter)) fail(path, 'não aceita parâmetros duplicados');
    seen.add(parameter);
    return {
      schemaVersion: literal(
        item.schemaVersion,
        1,
        `${itemPath}.schemaVersion`,
      ),
      parameter,
      origin: oneOf(item.origin, ORIGINS, `${itemPath}.origin`),
      ...provenanceDetails(item, itemPath),
    };
  });
  if (
    parsed.some(
      (item, index) =>
        index > 0 && parsed[index - 1]!.parameter > item.parameter,
    )
  ) {
    fail(path, 'deve estar ordenada por parâmetro');
  }
  return parsed;
}

function componentOrigins(
  value: unknown,
  path: string,
): PricingComponentProvenanceV1[] {
  const parsed = array(value, path).map((value, index) => {
    const itemPath = `${path}.${index}`;
    const item = record(value, itemPath, [
      'schemaVersion',
      'position',
      'origin',
      'sourceProductId',
      'effectiveUnitCost',
      ...PROVENANCE_KEYS,
    ]);
    const origin = oneOf(item.origin, COMPONENT_ORIGINS, `${itemPath}.origin`);
    const sourceProductId = nullableUuid(
      item.sourceProductId,
      `${itemPath}.sourceProductId`,
    );
    if ((origin === 'CATALOG') !== (sourceProductId !== null))
      fail(itemPath, 'origem e produto são incompatíveis');
    return {
      schemaVersion: literal(
        item.schemaVersion,
        1,
        `${itemPath}.schemaVersion`,
      ),
      position: integer(item.position, `${itemPath}.position`),
      origin,
      sourceProductId,
      effectiveUnitCost: decimal(
        item.effectiveUnitCost,
        `${itemPath}.effectiveUnitCost`,
      ),
      ...provenanceDetails(item, itemPath),
    };
  });
  assertPositions(parsed, path);
  return parsed;
}

function deductionOrigins(
  value: unknown,
  path: string,
): PricingDeductionProvenanceV1[] {
  const parsed = array(value, path).map((value, index) => {
    const itemPath = `${path}.${index}`;
    const item = record(value, itemPath, [
      'schemaVersion',
      'position',
      'origin',
      ...PROVENANCE_KEYS,
    ]);
    return {
      schemaVersion: literal(
        item.schemaVersion,
        1,
        `${itemPath}.schemaVersion`,
      ),
      position: integer(item.position, `${itemPath}.position`),
      origin: oneOf(item.origin, ORIGINS, `${itemPath}.origin`),
      ...provenanceDetails(item, itemPath),
    };
  });
  assertPositions(parsed, path);
  return parsed;
}

function toCalculatorInput(
  input: PricingCalculatorInputSnapshotV1,
): PricingCalculatorInput {
  return {
    currency: input.currency,
    components: input.components.map(
      ({ position: _position, productId, ...item }) => ({
        ...item,
        ...(productId === null ? {} : { productId }),
      }),
    ),
    ...(input.labor === null ? {} : { labor: input.labor }),
    ...(input.freight === null
      ? {}
      : input.freight.mode === 'MANUAL'
        ? { freight: input.freight }
        : {
            freight: {
              mode: input.freight.mode,
              totalCost: input.freight.totalCost,
              quantity: input.freight.quantity,
              ...(input.freight.consumedQuantity === null
                ? {}
                : { consumedQuantity: input.freight.consumedQuantity }),
            },
          }),
    ...(input.fixedCosts === null ? {} : { fixedCosts: input.fixedCosts }),
    deductions: input.deductions.map(
      ({ position: _position, ...item }) => item,
    ),
    desiredMargin: input.desiredMargin,
    ...(input.adoptedPrice === null
      ? {}
      : { adoptedPrice: input.adoptedPrice }),
  };
}

export function materializePricingSnapshotInputV1(
  input: PricingCalculatorInput,
): PricingCalculatorInputSnapshotV1 {
  return {
    currency: input.currency,
    components: (input.components ?? []).map((item, index) => ({
      position: index + 1,
      ...item,
      productId: item.productId ?? null,
    })),
    labor: input.labor ?? null,
    freight:
      input.freight === undefined
        ? null
        : input.freight.mode === 'ALLOCATED'
          ? {
              ...input.freight,
              consumedQuantity: input.freight.consumedQuantity ?? null,
            }
          : input.freight,
    fixedCosts: input.fixedCosts ?? null,
    deductions: (input.deductions ?? []).map((item, index) => ({
      position: index + 1,
      ...item,
    })),
    desiredMargin: input.desiredMargin,
    adoptedPrice:
      input.adoptedPrice === undefined
        ? null
        : canonicalDecimalText(input.adoptedPrice),
  };
}

export function materializePricingSnapshotResultV1(
  result: PricingCalculatorResult,
): PricingCalculatorResultSnapshotV1 {
  return {
    ...result,
    components: result.components.map((item, index) => ({
      position: index + 1,
      ...item,
      productId: item.productId ?? null,
    })),
    deductions: result.deductions.map((item, index) => ({
      position: index + 1,
      ...item,
    })),
    analysis: {
      ...result.analysis,
      deductions: result.analysis.deductions.map((item, index) => ({
        position: index + 1,
        ...item,
      })),
    },
    freight:
      result.freight === null
        ? null
        : result.freight.mode === 'MANUAL'
          ? result.freight
          : {
              ...result.freight,
              consumedQuantity: result.freight.consumedQuantity ?? '1',
            },
  };
}

function canonicalDecimalText(value: string): string {
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [rawInteger, rawFraction = ''] = unsigned.split('.');
  const integer = rawInteger!.replace(/^0+(?=\d)/, '');
  const fraction = rawFraction.replace(/0+$/, '');
  const normalized = fraction.length === 0 ? integer : `${integer}.${fraction}`;
  return negative && normalized !== '0' ? `-${normalized}` : normalized;
}

export function replayPricingSnapshotV1(
  snapshot: PricingSnapshotV1,
): PricingCalculatorResultSnapshotV1 {
  const replay = materializePricingSnapshotResultV1(
    calculatePricing(toCalculatorInput(snapshot.input)),
  );
  if (!isDeepStrictEqual(replay, snapshot.result)) {
    fail('result', 'diverge do replay da entrada congelada');
  }
  return replay;
}

export function parsePricingSnapshotV1(value: unknown): PricingSnapshotV1 {
  const root = record(value, 'snapshot', [
    'snapshotSchemaVersion',
    'formulaVersion',
    'input',
    'result',
    'context',
  ]);
  literal(root.snapshotSchemaVersion, 1, 'snapshot.snapshotSchemaVersion');
  literal(root.formulaVersion, 'margin-divisor-v1', 'snapshot.formulaVersion');
  const input = parseInput(root.input);
  const result = parseResult(root.result);
  const context = record(root.context, 'context', [
    'organizationId',
    'product',
    'composition',
    'configuration',
    'salesProfile',
    'effectiveDesiredMargin',
    'componentOrigins',
    'deductionOrigins',
    'calculatedAt',
    'calculatedByUserId',
    'decimalPolicy',
  ]);
  const product = record(context.product, 'context.product', [
    'id',
    'type',
    'name',
    'unit',
  ]);
  const composition = record(context.composition, 'context.composition', [
    'id',
    'revision',
    'parameterOrigins',
  ]);
  const configuration = record(context.configuration, 'context.configuration', [
    'id',
    'revisionId',
    'revision',
    'effectiveFrom',
    'currency',
    'fixedCosts',
    'monthlyLaborCost',
    'productiveHours',
    'defaultDesiredMargin',
    'parameterOrigins',
  ]);
  const margin = record(
    context.effectiveDesiredMargin,
    'context.effectiveDesiredMargin',
    ['value', 'origin', 'precedence'],
  );
  const policy = record(context.decimalPolicy, 'context.decimalPolicy', [
    'library',
    'precision',
    'commercialRounding',
    'informationalRounding',
  ]);
  let salesProfile: PricingSnapshotV1['context']['salesProfile'] = null;
  if (context.salesProfile !== null) {
    const profile = record(context.salesProfile, 'context.salesProfile', [
      'id',
      'revisionId',
      'revision',
      'name',
    ]);
    salesProfile = {
      id: uuid(profile.id, 'context.salesProfile.id'),
      revisionId: uuid(profile.revisionId, 'context.salesProfile.revisionId'),
      revision: integer(profile.revision, 'context.salesProfile.revision'),
      name: string(profile.name, 'context.salesProfile.name'),
    };
  }
  const parsed: PricingSnapshotV1 = {
    snapshotSchemaVersion: 1,
    formulaVersion: 'margin-divisor-v1',
    input,
    result,
    context: {
      organizationId: uuid(context.organizationId, 'context.organizationId'),
      product: {
        id: uuid(product.id, 'context.product.id'),
        type: string(product.type, 'context.product.type'),
        name: string(product.name, 'context.product.name'),
        unit: string(product.unit, 'context.product.unit'),
      },
      composition: {
        id: uuid(composition.id, 'context.composition.id'),
        revision: integer(composition.revision, 'context.composition.revision'),
        parameterOrigins: parameterOrigins(
          composition.parameterOrigins,
          'context.composition.parameterOrigins',
        ),
      },
      configuration: {
        id: uuid(configuration.id, 'context.configuration.id'),
        revisionId: uuid(
          configuration.revisionId,
          'context.configuration.revisionId',
        ),
        revision: integer(
          configuration.revision,
          'context.configuration.revision',
        ),
        effectiveFrom: timestamp(
          configuration.effectiveFrom,
          'context.configuration.effectiveFrom',
        ),
        currency: literal(
          configuration.currency,
          'BRL',
          'context.configuration.currency',
        ),
        fixedCosts: fixedCosts(
          configuration.fixedCosts,
          'context.configuration.fixedCosts',
          false,
        ) as PricingSnapshotV1['context']['configuration']['fixedCosts'],
        monthlyLaborCost: nullableDecimal(
          configuration.monthlyLaborCost,
          'context.configuration.monthlyLaborCost',
        ),
        productiveHours: nullableDecimal(
          configuration.productiveHours,
          'context.configuration.productiveHours',
        ),
        defaultDesiredMargin: nullableDecimal(
          configuration.defaultDesiredMargin,
          'context.configuration.defaultDesiredMargin',
        ),
        parameterOrigins: parameterOrigins(
          configuration.parameterOrigins,
          'context.configuration.parameterOrigins',
        ),
      },
      salesProfile,
      effectiveDesiredMargin: {
        value: decimal(margin.value, 'context.effectiveDesiredMargin.value'),
        origin: oneOf(
          margin.origin,
          ORIGINS,
          'context.effectiveDesiredMargin.origin',
        ),
        precedence: oneOf(
          margin.precedence,
          ['COMPOSITION', 'CONFIGURATION'] as const,
          'context.effectiveDesiredMargin.precedence',
        ),
      },
      componentOrigins: componentOrigins(
        context.componentOrigins,
        'context.componentOrigins',
      ),
      deductionOrigins: deductionOrigins(
        context.deductionOrigins,
        'context.deductionOrigins',
      ),
      calculatedAt: timestamp(context.calculatedAt, 'context.calculatedAt'),
      calculatedByUserId: uuid(
        context.calculatedByUserId,
        'context.calculatedByUserId',
      ),
      decimalPolicy: {
        library: literal(
          policy.library,
          'decimal.js',
          'context.decimalPolicy.library',
        ),
        precision: literal(
          policy.precision,
          160,
          'context.decimalPolicy.precision',
        ),
        commercialRounding: literal(
          policy.commercialRounding,
          'ROUND_CEIL',
          'context.decimalPolicy.commercialRounding',
        ),
        informationalRounding: literal(
          policy.informationalRounding,
          'ROUND_HALF_UP',
          'context.decimalPolicy.informationalRounding',
        ),
      },
    },
  };
  if (result.formulaVersion !== parsed.formulaVersion)
    fail('result.formulaVersion', 'diverge do snapshot');
  if (
    result.currency !== input.currency ||
    parsed.context.configuration.currency !== input.currency
  )
    fail('currency', 'diverge entre entrada, resultado e contexto');
  if (parsed.context.effectiveDesiredMargin.value !== input.desiredMargin)
    fail('context.effectiveDesiredMargin.value', 'diverge da entrada');
  const contextualFixedCosts = parsed.context.configuration.fixedCosts;
  const inputFixedCosts =
    input.fixedCosts === null
      ? null
      : input.fixedCosts.mode === 'RATE'
        ? { mode: input.fixedCosts.mode, rate: input.fixedCosts.rate }
        : {
            mode: input.fixedCosts.mode,
            monthlyCost: input.fixedCosts.monthlyCost,
            averageRevenue: input.fixedCosts.averageRevenue,
          };
  if (!isDeepStrictEqual(contextualFixedCosts, inputFixedCosts))
    fail('context.configuration.fixedCosts', 'diverge da entrada');
  if (
    input.labor !== null &&
    (input.labor.monthlyCost !==
      parsed.context.configuration.monthlyLaborCost ||
      input.labor.productiveHours !==
        parsed.context.configuration.productiveHours)
  )
    fail('context.configuration', 'diverge da mão de obra congelada');
  if (
    parsed.context.salesProfile === null &&
    (input.deductions.length > 0 || parsed.context.deductionOrigins.length > 0)
  )
    fail('context.salesProfile', 'é incompatível com as deduções');
  if (
    parsed.context.componentOrigins.length !== input.components.length ||
    parsed.context.deductionOrigins.length !== input.deductions.length
  )
    fail('context', 'proveniências não correspondem às coleções');
  input.components.forEach((item, index) => {
    const origin = parsed.context.componentOrigins[index]!;
    if (
      origin.position !== item.position ||
      origin.origin !== item.origin ||
      origin.sourceProductId !== item.productId ||
      origin.effectiveUnitCost !== item.unitCost
    )
      fail(`context.componentOrigins.${index}`, 'diverge do componente');
  });
  input.deductions.forEach((item, index) => {
    const origin = parsed.context.deductionOrigins[index]!;
    if (origin.position !== item.position || origin.origin !== item.origin)
      fail(`context.deductionOrigins.${index}`, 'diverge da dedução');
  });
  replayPricingSnapshotV1(parsed);
  return parsed;
}
