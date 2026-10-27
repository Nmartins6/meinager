import type { PricingCalculatorInput, PricingCalculatorResult } from '@meinager/pricing-calculator';

import type { Product } from '@/features/products/products-api';

import type { PricingComposition } from './pricing-composition-contracts';
import {
  buildPricingCompositionInput,
  type PricingCompositionFormValues,
} from './pricing-composition-form-state';
import {
  pricingCalculatorResultSchema,
  pricingSimulationInputSchema,
  type PricingSimulationInput,
  type PricingSimulationResponse,
} from './pricing-simulation-contracts';

export function buildPricingSimulationInput(
  values: PricingCompositionFormValues,
  composition: PricingComposition | null,
  product: Pick<Product, 'salePrice'>,
): PricingSimulationInput {
  const { input, changed } = buildPricingCompositionInput(values, composition);
  const adoptedPrice = typeof product.salePrice === 'string' ? product.salePrice : undefined;
  if (composition && !changed) {
    return pricingSimulationInputSchema.parse({
      source: 'PERSISTED',
      ...(adoptedPrice === undefined ? {} : { adoptedPrice }),
    });
  }
  const { expectedRevision: _expectedRevision, ...draft } = input;
  return pricingSimulationInputSchema.parse({
    source: 'DRAFT',
    draft,
    ...(adoptedPrice === undefined ? {} : { adoptedPrice }),
  });
}

export function pricingSimulationSignature(input: PricingSimulationInput): string {
  return JSON.stringify(pricingSimulationInputSchema.parse(input));
}

export function hasAuthoritativeResolvedInputParity(
  local: PricingCalculatorInput,
  response: PricingSimulationResponse,
): boolean {
  const fingerprint = (input: PricingCalculatorInput) =>
    JSON.stringify({
      currency: input.currency,
      components: (input.components ?? []).map((item) => [
        item.description,
        item.category,
        item.unit,
        item.quantity,
        item.unitCost,
        item.origin,
        item.productId ?? null,
      ]),
      labor: input.labor
        ? [input.labor.monthlyCost, input.labor.productiveHours, input.labor.timeMinutes]
        : null,
      freight: input.freight
        ? input.freight.mode === 'MANUAL'
          ? ['MANUAL', input.freight.unitCost]
          : [
              'ALLOCATED',
              input.freight.totalCost,
              input.freight.quantity,
              input.freight.consumedQuantity ?? '1',
            ]
        : null,
      fixedCosts: input.fixedCosts
        ? input.fixedCosts.mode === 'RATE'
          ? ['RATE', input.fixedCosts.rate, input.fixedCosts.origin]
          : [
              'MONTHLY',
              input.fixedCosts.monthlyCost,
              input.fixedCosts.averageRevenue,
              input.fixedCosts.origin,
            ]
        : null,
      deductions: (input.deductions ?? []).map((item) => [
        item.name,
        item.category,
        item.rate,
        item.origin,
      ]),
      desiredMargin: input.desiredMargin,
      adoptedPrice: input.adoptedPrice ?? null,
    });
  return fingerprint(local) === fingerprint(response.resolvedInput);
}

export function hasAuthoritativePricingParity(
  localResult: PricingCalculatorResult,
  response: PricingSimulationResponse,
): boolean {
  const local = pricingCalculatorResultSchema.safeParse(localResult);
  return (
    local.success &&
    response.formulaVersion === local.data.formulaVersion &&
    JSON.stringify(local.data) === JSON.stringify(response.result)
  );
}
