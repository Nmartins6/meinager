import type { PricingCalculatorResult } from '@meinager/pricing-calculator';

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
