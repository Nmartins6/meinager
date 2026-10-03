/** Financial inputs and outputs are decimal strings, never binary floats. */
export type DecimalString = string;
export type PricingParameterOrigin =
  'MANUAL' | 'FINANCIAL_AGGREGATE' | 'COPIED';
export type PricingComponentCategory =
  | 'DIRECT_COST'
  | 'MATERIAL'
  | 'PACKAGING'
  | 'LABOR'
  | 'FREIGHT'
  | 'OUTSOURCING'
  | 'LOSS'
  | 'OTHER';

export interface PricingComponentInput {
  readonly description: string;
  readonly category: PricingComponentCategory;
  readonly unit: string;
  readonly quantity: DecimalString;
  readonly unitCost: DecimalString;
  readonly origin: 'MANUAL' | 'CATALOG' | 'COPIED';
  /** Opaque traceability only; ownership must be checked by the application. */
  readonly productId?: string;
}

export interface PricingDeductionInput {
  readonly name: string;
  readonly category: string;
  /** Fraction: '0.06' means 6%. Array order is presentation order. */
  readonly rate: DecimalString;
  readonly origin: PricingParameterOrigin;
}

export type PricingFixedCostsInput =
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

export interface PricingLaborInput {
  readonly monthlyCost: DecimalString;
  readonly productiveHours: DecimalString;
  /** Canonical time unit; hours/minutes conversion belongs to the caller. */
  readonly timeMinutes: DecimalString;
}

export type PricingFreightInput =
  | { readonly mode: 'MANUAL'; readonly unitCost: DecimalString }
  | {
      readonly mode: 'ALLOCATED';
      readonly totalCost: DecimalString;
      readonly quantity: DecimalString;
      /** One unit of the lot is consumed when omitted. */
      readonly consumedQuantity?: DecimalString;
    };

export interface PricingCalculatorInput {
  readonly currency: 'BRL';
  readonly components?: readonly PricingComponentInput[];
  readonly labor?: PricingLaborInput;
  readonly freight?: PricingFreightInput;
  readonly fixedCosts?: PricingFixedCostsInput;
  readonly deductions?: readonly PricingDeductionInput[];
  readonly desiredMargin: DecimalString;
  readonly adoptedPrice?: DecimalString;
}

export interface PricingMoney {
  /** Unrounded result, including working-precision digits for recurring divisions. */
  readonly exact: DecimalString;
  /** Two decimal places, ROUND_HALF_UP; never fed back into the calculation. */
  readonly display: DecimalString;
}

export interface PricingPrice {
  readonly exact: DecimalString;
  /** Two decimal places, rounded upward. */
  readonly commercial: DecimalString;
}

export type PricingClassification =
  | 'BELOW_MINIMUM'
  | 'COST_COVERAGE'
  | 'BELOW_DESIRED_MARGIN'
  | 'DESIRED_MARGIN_MET'
  | 'ABOVE_DESIRED_MARGIN';

export interface PricingWarning {
  readonly code: 'BELOW_MINIMUM' | 'BELOW_DESIRED_MARGIN';
  readonly message: string;
}

export interface PricingCalculatorResult {
  readonly formulaVersion: 'margin-divisor-v1';
  readonly currency: 'BRL';
  readonly components: readonly (PricingComponentInput & {
    readonly total: PricingMoney;
  })[];
  readonly labor:
    | (PricingLaborInput & {
        readonly costPerHour: PricingMoney;
        readonly costPerMinute: PricingMoney;
        readonly total: PricingMoney;
      })
    | null;
  readonly freight:
    | (PricingFreightInput & {
        readonly costPerLotUnit: PricingMoney;
        readonly total: PricingMoney;
      })
    | null;
  readonly fixedCosts: {
    readonly input: PricingFixedCostsInput | null;
    readonly rate: DecimalString;
  };
  readonly deductions: readonly PricingDeductionInput[];
  readonly totalDeductionRate: DecimalString;
  readonly desiredMargin: DecimalString;
  readonly baseCost: PricingMoney;
  readonly minimumPrice: PricingPrice;
  readonly suggestedPrice: PricingPrice;
  readonly adoptedPrice: DecimalString | null;
  readonly analysis: {
    /** Adopted price when provided, otherwise suggested commercial price. */
    readonly price: DecimalString;
    readonly fixedCosts: PricingMoney;
    readonly deductions: readonly (PricingDeductionInput & {
      readonly amount: PricingMoney;
    })[];
    readonly totalDeductions: PricingMoney;
    readonly profit: PricingMoney;
    readonly effectiveMargin: DecimalString | null;
    readonly differenceFromSuggestedExact: PricingMoney;
    readonly classification: PricingClassification;
  };
  /** Theoretical discount from exact prices; null when suggested price is zero. */
  readonly maximumDiscountRate: DecimalString | null;
  readonly warnings: readonly PricingWarning[];
}
