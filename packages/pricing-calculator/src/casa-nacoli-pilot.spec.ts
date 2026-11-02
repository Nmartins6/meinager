import { describe, expect, it } from 'vitest';

import { calculatePricing } from './pricing-calculator.js';
import type { PricingCalculatorInput, PricingComponentInput } from './pricing-calculator.types.js';

// All money here is fictional test input, not Casa Nacoli's actual cost or a product default.
function component(description: string, quantity: string, unitCost: string): PricingComponentInput {
  return { description, category: 'MATERIAL', unit: 'UN', quantity, unitCost, origin: 'MANUAL' };
}

function input(components: PricingComponentInput[], timeMinutes: string): PricingCalculatorInput {
  return {
    currency: 'BRL',
    components,
    labor: { monthlyCost: '2400', productiveHours: '160', timeMinutes },
    fixedCosts: { mode: 'RATE', rate: '0.1', origin: 'MANUAL' },
    desiredMargin: '0.25',
  };
}

describe('Casa Nacoli: cenários fictícios, conferíveis por CB/(1-PF-ML)', () => {
  it.each([
    {
      name: 'caneca, cinco minutos por unidade',
      components: [
        component('Caneca branca', '1', '8.5'),
        component('Papel sublimático', '1', '0.8'),
        component('Impressão', '1', '1.2'),
        component('Custo interno da arte, fora do tempo de produção', '1', '2'),
      ],
      minutes: '5',
      base: '13.75',
      minimum: '15.28',
      suggested: '21.16',
    },
    {
      name: 'camiseta, oito minutos por unidade',
      components: [
        component('Camiseta branca', '1', '12'),
        component('Papel sublimático', '1', '0.8'),
        component('Impressão', '1', '1.2'),
        component('Custo interno da arte, fora do tempo de produção', '1', '2'),
      ],
      minutes: '8',
      base: '18',
      minimum: '20.00',
      suggested: '27.70',
    },
    {
      name: 'jogo de 12 peças, uma A4, arte uma vez por jogo',
      components: [
        component('Kit MDF de 12 peças', '1', '5'),
        component('Folha A4', '1', '1'),
        component('Impressão A4', '1', '1.2'),
        component('Custo interno da arte por jogo', '1', '2'),
      ],
      minutes: '5',
      base: '10.45',
      minimum: '11.62',
      suggested: '16.08',
    },
    {
      name: 'jogo fictício que usa duas A4, sem multiplicar a arte',
      components: [
        component('Kit MDF de 12 peças', '1', '5'),
        component('Folha A4', '2', '1'),
        component('Impressão A4', '2', '1.2'),
        component('Custo interno da arte por jogo', '1', '2'),
      ],
      minutes: '5',
      base: '12.65',
      minimum: '14.06',
      suggested: '19.47',
    },
  ])('$name', ({ components, minutes, base, minimum, suggested }) => {
    const result = calculatePricing(input(components, minutes));
    expect(result.baseCost.exact).toBe(base);
    expect(result.minimumPrice.commercial).toBe(minimum);
    expect(result.suggestedPrice.commercial).toBe(suggested);
    expect(result.components.at(-1)?.quantity).toBe('1');
  });
});
