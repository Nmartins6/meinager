import { Decimal } from 'decimal.js';

import { PricingCalculatorError } from './pricing-calculator.errors.js';
import type {
  PricingCalculatorInput,
  PricingCalculatorResult,
  PricingClassification,
  PricingMoney,
  PricingWarning,
} from './pricing-calculator.types.js';
import { createPricingDecimal, decimalText } from './pricing-decimal.js';

interface Ratio {
  numerator: Decimal;
  denominator: Decimal;
}

function quotient(ratio: Ratio): Decimal {
  return ratio.numerator.div(ratio.denominator);
}

function money(value: Decimal): PricingMoney {
  return {
    exact: decimalText(value),
    display: value.toFixed(2, Decimal.ROUND_HALF_UP),
  };
}

function classify(price: Decimal, minimum: Decimal, suggested: Decimal): PricingClassification {
  if (price.lt(minimum)) return 'BELOW_MINIMUM';
  if (price.eq(minimum)) return 'COST_COVERAGE';
  if (price.lt(suggested)) return 'BELOW_DESIRED_MARGIN';
  if (price.eq(suggested)) return 'DESIRED_MARGIN_MET';
  return 'ABOVE_DESIRED_MARGIN';
}

/** Pure calculation; the application supplies consolidated, authorized inputs. */
export function calculatePricing(input: PricingCalculatorInput): PricingCalculatorResult {
  const { readDecimal, decimalConstant } = createPricingDecimal();
  if (input.currency !== 'BRL') {
    throw new PricingCalculatorError(
      'UNSUPPORTED_CURRENCY',
      'currency',
      'A moeda operacional deve ser BRL.',
    );
  }
  const zero = decimalConstant('0');
  const one = decimalConstant('1');
  const desiredMargin = readDecimal(input.desiredMargin, 'desiredMargin', 'RATE');
  const adopted =
    input.adoptedPrice === undefined
      ? null
      : readDecimal(input.adoptedPrice, 'adoptedPrice', 'PRICE');

  const components = (input.components ?? []).map((component, index) => {
    const quantity = readDecimal(component.quantity, `components[${index}].quantity`);
    const unitCost = readDecimal(component.unitCost, `components[${index}].unitCost`);
    return {
      ...component,
      quantity: decimalText(quantity),
      unitCost: decimalText(unitCost),
      total: money(quantity.mul(unitCost)),
    };
  });
  const componentCost = components.reduce(
    (sum, component) => sum.plus(component.total.exact),
    zero,
  );

  // Retain exact fractions until the complete base cost/price is formed. Computing
  // a recurring per-minute cost first can turn an exact cent boundary into dust.
  let laborRatio: Ratio = { numerator: zero, denominator: one };
  let labor: PricingCalculatorResult['labor'] = null;
  if (input.labor !== undefined) {
    const monthlyCost = readDecimal(input.labor.monthlyCost, 'labor.monthlyCost');
    const hours = readDecimal(input.labor.productiveHours, 'labor.productiveHours');
    const minutes = readDecimal(input.labor.timeMinutes, 'labor.timeMinutes');
    if (hours.isZero()) {
      throw new PricingCalculatorError(
        'INVALID_PRODUCTIVE_HOURS',
        'labor.productiveHours',
        'As horas produtivas mensais devem ser maiores que zero.',
      );
    }
    const productiveMinutes = hours.mul(decimalConstant('60'));
    laborRatio = {
      numerator: monthlyCost.mul(minutes),
      denominator: productiveMinutes,
    };
    labor = {
      monthlyCost: decimalText(monthlyCost),
      productiveHours: decimalText(hours),
      timeMinutes: decimalText(minutes),
      costPerHour: money(monthlyCost.div(hours)),
      costPerMinute: money(monthlyCost.div(productiveMinutes)),
      total: money(quotient(laborRatio)),
    };
  }

  let freightRatio: Ratio = { numerator: zero, denominator: one };
  let freight: PricingCalculatorResult['freight'] = null;
  if (input.freight !== undefined) {
    if (input.freight.mode === 'MANUAL') {
      const cost = readDecimal(input.freight.unitCost, 'freight.unitCost');
      freightRatio = { numerator: cost, denominator: one };
      freight = {
        mode: 'MANUAL',
        unitCost: decimalText(cost),
        costPerLotUnit: money(cost),
        total: money(cost),
      };
    } else {
      const totalCost = readDecimal(input.freight.totalCost, 'freight.totalCost');
      const quantity = readDecimal(input.freight.quantity, 'freight.quantity');
      const consumed = readDecimal(
        input.freight.consumedQuantity ?? '1',
        'freight.consumedQuantity',
      );
      if (quantity.isZero()) {
        throw new PricingCalculatorError(
          'INVALID_FREIGHT_QUANTITY',
          'freight.quantity',
          'A quantidade utilizada no rateio do frete deve ser maior que zero.',
        );
      }
      freightRatio = {
        numerator: totalCost.mul(consumed),
        denominator: quantity,
      };
      freight = {
        mode: 'ALLOCATED',
        totalCost: decimalText(totalCost),
        quantity: decimalText(quantity),
        consumedQuantity: decimalText(consumed),
        costPerLotUnit: money(totalCost.div(quantity)),
        total: money(quotient(freightRatio)),
      };
    }
  }

  const base: Ratio = {
    numerator: componentCost
      .mul(laborRatio.denominator)
      .mul(freightRatio.denominator)
      .plus(laborRatio.numerator.mul(freightRatio.denominator))
      .plus(freightRatio.numerator.mul(laborRatio.denominator)),
    denominator: laborRatio.denominator.mul(freightRatio.denominator),
  };

  let fixedRatio: Ratio = { numerator: zero, denominator: one };
  let fixedInput: PricingCalculatorResult['fixedCosts']['input'] = null;
  if (input.fixedCosts !== undefined) {
    if (input.fixedCosts.mode === 'RATE') {
      const rate = readDecimal(input.fixedCosts.rate, 'fixedCosts.rate', 'RATE');
      fixedRatio = { numerator: rate, denominator: one };
      fixedInput = { ...input.fixedCosts, rate: decimalText(rate) };
    } else {
      const cost = readDecimal(input.fixedCosts.monthlyCost, 'fixedCosts.monthlyCost');
      const revenue = readDecimal(input.fixedCosts.averageRevenue, 'fixedCosts.averageRevenue');
      if (revenue.isZero()) {
        throw new PricingCalculatorError(
          'INVALID_AVERAGE_REVENUE',
          'fixedCosts.averageRevenue',
          'O faturamento mensal médio deve ser maior que zero.',
        );
      }
      fixedRatio = { numerator: cost, denominator: revenue };
      fixedInput = {
        ...input.fixedCosts,
        monthlyCost: decimalText(cost),
        averageRevenue: decimalText(revenue),
      };
    }
  }
  const deductions = (input.deductions ?? []).map((deduction, index) => ({
    ...deduction,
    rate: decimalText(readDecimal(deduction.rate, `deductions[${index}].rate`, 'RATE')),
  }));
  const totalRate = deductions.reduce((sum, deduction) => sum.plus(deduction.rate), zero);
  const minimumDivisorNumerator = fixedRatio.denominator
    .mul(one.minus(totalRate))
    .minus(fixedRatio.numerator);
  const suggestedDivisorNumerator = minimumDivisorNumerator.minus(
    fixedRatio.denominator.mul(desiredMargin),
  );
  if (minimumDivisorNumerator.lte(zero) || suggestedDivisorNumerator.lte(zero)) {
    throw new PricingCalculatorError(
      'INVALID_PRICING_DIVISOR',
      'divisor',
      'A soma dos percentuais de custos, taxas e margem deve ser menor que 100%. Revise os valores para calcular um preço válido.',
    );
  }

  const minimumRatio: Ratio = {
    numerator: base.numerator.mul(fixedRatio.denominator),
    denominator: base.denominator.mul(minimumDivisorNumerator),
  };
  const suggestedRatio: Ratio = {
    numerator: minimumRatio.numerator,
    denominator: base.denominator.mul(suggestedDivisorNumerator),
  };
  const minimumExact = quotient(minimumRatio);
  const suggestedExact = quotient(suggestedRatio);
  const minimumCommercial = minimumExact.toDecimalPlaces(2, Decimal.ROUND_CEIL);
  const suggestedCommercial = suggestedExact.toDecimalPlaces(2, Decimal.ROUND_CEIL);
  const price = adopted ?? suggestedCommercial;
  const profitRatio: Ratio = {
    numerator: price
      .mul(minimumDivisorNumerator)
      .mul(base.denominator)
      .minus(base.numerator.mul(fixedRatio.denominator)),
    denominator: fixedRatio.denominator.mul(base.denominator),
  };
  const classification = classify(price, minimumCommercial, suggestedCommercial);
  const warnings: PricingWarning[] = [];
  if (classification === 'BELOW_MINIMUM') {
    warnings.push({
      code: 'BELOW_MINIMUM',
      message: 'O preço é insuficiente para cobrir os custos; há prejuízo estimado.',
    });
  } else if (classification === 'BELOW_DESIRED_MARGIN') {
    warnings.push({
      code: 'BELOW_DESIRED_MARGIN',
      message: 'O preço cobre os custos, mas não atinge a margem desejada.',
    });
  }

  return {
    formulaVersion: 'margin-divisor-v1',
    currency: input.currency,
    components,
    labor,
    freight,
    fixedCosts: { input: fixedInput, rate: decimalText(quotient(fixedRatio)) },
    deductions,
    totalDeductionRate: decimalText(totalRate),
    desiredMargin: decimalText(desiredMargin),
    baseCost: money(quotient(base)),
    minimumPrice: {
      exact: decimalText(minimumExact),
      commercial: minimumCommercial.toFixed(2),
    },
    suggestedPrice: {
      exact: decimalText(suggestedExact),
      commercial: suggestedCommercial.toFixed(2),
    },
    adoptedPrice: adopted?.toFixed(2) ?? null,
    analysis: {
      price: price.toFixed(2),
      fixedCosts: money(price.mul(fixedRatio.numerator).div(fixedRatio.denominator)),
      deductions: deductions.map((deduction) => ({
        ...deduction,
        amount: money(price.mul(deduction.rate)),
      })),
      totalDeductions: money(price.mul(totalRate)),
      profit: money(quotient(profitRatio)),
      effectiveMargin: price.isZero()
        ? null
        : decimalText(profitRatio.numerator.div(profitRatio.denominator.mul(price))),
      differenceFromSuggestedExact: money(
        price
          .mul(suggestedRatio.denominator)
          .minus(suggestedRatio.numerator)
          .div(suggestedRatio.denominator),
      ),
      classification,
    },
    // Algebraically 1 - PMIN/PSUG, with the common base cost canceled.
    maximumDiscountRate: base.numerator.isZero()
      ? null
      : decimalText(desiredMargin.mul(fixedRatio.denominator).div(minimumDivisorNumerator)),
    warnings,
  };
}
