import { Decimal } from 'decimal.js';

import { calculatePricing } from './pricing-calculator.js';
import { PricingCalculatorError } from './pricing-calculator.errors.js';
import type { PricingCalculatorErrorCode } from './pricing-calculator.errors.js';
import type {
  PricingCalculatorInput,
  PricingComponentInput,
} from './pricing-calculator.types.js';

const TestDecimal = Decimal.clone({ defaults: true, precision: 180 });

function component(unitCost: string, quantity = '1'): PricingComponentInput {
  return {
    description: 'Custo direto',
    category: 'DIRECT_COST',
    unit: 'UN',
    quantity,
    unitCost,
    origin: 'MANUAL',
  };
}

function simple(
  overrides: Partial<PricingCalculatorInput> = {},
): PricingCalculatorInput {
  return {
    currency: 'BRL',
    components: [component('50')],
    fixedCosts: { mode: 'RATE', rate: '0.1', origin: 'MANUAL' },
    deductions: [
      { name: 'Imposto', category: 'TAX', rate: '0.06', origin: 'MANUAL' },
      {
        name: 'Pagamento',
        category: 'PAYMENT',
        rate: '0.04',
        origin: 'MANUAL',
      },
    ],
    desiredMargin: '0.25',
    ...overrides,
  };
}

function complete(
  overrides: Partial<PricingCalculatorInput> = {},
): PricingCalculatorInput {
  return {
    currency: 'BRL',
    components: [
      {
        ...component('12.5', '2'),
        description: 'Material',
        category: 'MATERIAL',
        origin: 'CATALOG',
        productId: 'catalog-material',
      },
      { ...component('2'), description: 'Embalagem', category: 'PACKAGING' },
      { ...component('1.5'), description: 'Perdas', category: 'LOSS' },
    ],
    labor: { monthlyCost: '3300', productiveHours: '165', timeMinutes: '90' },
    freight: { mode: 'ALLOCATED', totalCost: '120', quantity: '40' },
    fixedCosts: {
      mode: 'MONTHLY',
      monthlyCost: '3000',
      averageRevenue: '15000',
      origin: 'MANUAL',
    },
    deductions: [
      { name: 'Imposto', category: 'TAX', rate: '0.06', origin: 'MANUAL' },
      {
        name: 'Pagamento',
        category: 'PAYMENT',
        rate: '0.035',
        origin: 'MANUAL',
      },
      {
        name: 'Comissão',
        category: 'COMMISSION',
        rate: '0.02',
        origin: 'MANUAL',
      },
    ],
    desiredMargin: '0.25',
    ...overrides,
  };
}

function expectError(
  input: PricingCalculatorInput,
  code: PricingCalculatorErrorCode,
  field?: string,
) {
  expect(() => calculatePricing(input)).toThrow(PricingCalculatorError);
  expect(() => calculatePricing(input)).toThrow(
    expect.objectContaining({ code, ...(field ? { field } : {}) }),
  );
}

describe('margin-divisor-v1 — exemplos oficiais', () => {
  it('EX-001 — precificação simples', () => {
    const result = calculatePricing(simple());
    expect(result.formulaVersion).toBe('margin-divisor-v1');
    expect(result.minimumPrice).toEqual({ exact: '62.5', commercial: '62.50' });
    expect(result.suggestedPrice.exact).toMatch(/^90\.909090909090/);
    expect(result.suggestedPrice.commercial).toBe('90.91');
    expect(result.adoptedPrice).toBeNull();
    expect(result.analysis.price).toBe('90.91');
    expect(result.analysis.fixedCosts.exact).toBe('9.091');
    expect(
      result.analysis.deductions.map((deduction) => deduction.amount.exact),
    ).toEqual(['5.4546', '3.6364']);
    expect(result.analysis.totalDeductions.exact).toBe('9.091');
    expect(result.analysis.profit).toEqual({
      exact: '22.728',
      display: '22.73',
    });
    expect(result.analysis.effectiveMargin).toMatch(/^0\.250005499945/);
    expect(
      new TestDecimal(result.analysis.effectiveMargin!)
        .mul('100')
        .toFixed(4, Decimal.ROUND_HALF_UP),
    ).toBe('25.0005');
    expect(result.maximumDiscountRate).toBe('0.3125');
  });

  it('EX-002 — precificação completa', () => {
    const result = calculatePricing(complete());
    expect(result.components.map((item) => item.total.exact)).toEqual([
      '25',
      '2',
      '1.5',
    ]);
    expect(result.components[0].productId).toBe('catalog-material');
    expect(result.labor?.costPerHour.exact).toBe('20');
    expect(result.labor?.costPerMinute.exact).toMatch(/^0\.333333333333/);
    expect(result.labor?.total.exact).toBe('30');
    expect(result.freight?.total.exact).toBe('3');
    expect(result.baseCost).toEqual({ exact: '61.5', display: '61.50' });
    expect(result.fixedCosts.rate).toBe('0.2');
    expect(result.totalDeductionRate).toBe('0.115');
    expect(result.minimumPrice.exact).toMatch(/^89\.781021897810/);
    expect(result.minimumPrice.commercial).toBe('89.79');
    expect(result.suggestedPrice.exact).toMatch(/^141\.379310344827/);
    expect(result.suggestedPrice.commercial).toBe('141.38');
    expect(result.analysis.fixedCosts.exact).toBe('28.276');
    expect(result.analysis.deductions.map((item) => item.amount.exact)).toEqual(
      ['8.4828', '4.9483', '2.8276'],
    );
    expect(result.analysis.totalDeductions.exact).toBe('16.2587');
    expect(result.analysis.profit.exact).toBe('35.3453');
    expect(result.analysis.effectiveMargin).toMatch(/^0\.250002121940/);
    expect(
      new TestDecimal(result.analysis.effectiveMargin!)
        .mul('100')
        .toFixed(4, Decimal.ROUND_HALF_UP),
    ).toBe('25.0002');
  });

  it('EX-003 — preço adotado rentável abaixo da margem', () => {
    const result = calculatePricing(complete({ adoptedPrice: '120.00' }));
    expect(result.adoptedPrice).toBe('120.00');
    expect(result.analysis.fixedCosts.exact).toBe('24');
    expect(result.analysis.totalDeductions.exact).toBe('13.8');
    expect(result.analysis.profit.exact).toBe('20.7');
    expect(result.analysis.effectiveMargin).toBe('0.1725');
    expect(result.analysis.classification).toBe('BELOW_DESIRED_MARGIN');
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      'BELOW_DESIRED_MARGIN',
    ]);
  });

  it('EX-004 — preço adotado abaixo do mínimo', () => {
    const result = calculatePricing(complete({ adoptedPrice: '80' }));
    expect(result.analysis.fixedCosts.exact).toBe('16');
    expect(result.analysis.totalDeductions.exact).toBe('9.2');
    expect(result.analysis.profit).toEqual({ exact: '-6.7', display: '-6.70' });
    expect(result.analysis.effectiveMargin).toBe('-0.08375');
    expect(result.analysis.classification).toBe('BELOW_MINIMUM');
    expect(result.warnings).toEqual([
      {
        code: 'BELOW_MINIMUM',
        message: expect.stringContaining('insuficiente para cobrir os custos'),
      },
    ]);
  });

  it('EX-005 — sem custos fixos ou deduções', () => {
    const result = calculatePricing({
      currency: 'BRL',
      components: [component('100')],
      desiredMargin: '0.2',
    });
    expect(result.minimumPrice.commercial).toBe('100.00');
    expect(result.suggestedPrice.commercial).toBe('125.00');
    expect(result.analysis.profit.exact).toBe('25');
    expect(result.analysis.effectiveMargin).toBe('0.2');
    expect(result.maximumDiscountRate).toBe('0.2');
  });

  it('EX-006 — divisor igual a zero', () => {
    expectError(
      simple({
        deductions: [
          {
            name: 'Deduções',
            category: 'OTHER',
            rate: '0.2',
            origin: 'MANUAL',
          },
        ],
        desiredMargin: '0.7',
      }),
      'INVALID_PRICING_DIVISOR',
      'divisor',
    );
  });

  it('EX-007 — divisor negativo', () => {
    expectError(
      simple({
        fixedCosts: { mode: 'RATE', rate: '0.3', origin: 'MANUAL' },
        deductions: [
          {
            name: 'Deduções',
            category: 'OTHER',
            rate: '0.25',
            origin: 'MANUAL',
          },
        ],
        desiredMargin: '0.5',
      }),
      'INVALID_PRICING_DIVISOR',
    );
  });

  it('EX-008 — faturamento médio inválido', () => {
    expectError(
      complete({
        fixedCosts: {
          mode: 'MONTHLY',
          monthlyCost: '2000',
          averageRevenue: '0',
          origin: 'MANUAL',
        },
      }),
      'INVALID_AVERAGE_REVENUE',
      'fixedCosts.averageRevenue',
    );
  });

  it('EX-009 — horas produtivas inválidas', () => {
    expectError(
      complete({
        labor: { monthlyCost: '3300', productiveHours: '0', timeMinutes: '90' },
      }),
      'INVALID_PRODUCTIVE_HOURS',
      'labor.productiveHours',
    );
  });

  it('EX-010 — quantidade de frete inválida', () => {
    expectError(
      complete({
        freight: { mode: 'ALLOCATED', totalCost: '120', quantity: '0' },
      }),
      'INVALID_FREIGHT_QUANTITY',
      'freight.quantity',
    );
  });

  it('EX-011 — próximo centavo e margem após arredondamento', () => {
    const result = calculatePricing({
      currency: 'BRL',
      components: [component('1')],
      desiredMargin: '0.33',
    });
    expect(result.suggestedPrice.exact).toMatch(/^1\.492537313432/);
    expect(result.suggestedPrice.commercial).toBe('1.50');
    expect(result.analysis.profit.exact).toBe('0.5');
    expect(new TestDecimal(result.analysis.effectiveMargin!).gt('0.33')).toBe(
      true,
    );
  });

  it('EX-012 — componentes opcionais ausentes', () => {
    const result = calculatePricing({
      currency: 'BRL',
      components: [component('40')],
      desiredMargin: '0',
    });
    expect(result.baseCost.exact).toBe('40');
    expect(result.minimumPrice.commercial).toBe('40.00');
    expect(result.suggestedPrice.commercial).toBe('40.00');
    expect(result.analysis.profit.display).toBe('0.00');
    expect(result.labor).toBeNull();
    expect(result.freight).toBeNull();
    expect(result.fixedCosts).toEqual({ input: null, rate: '0' });
    expect(result.deductions).toEqual([]);
  });
});

describe('margin-divisor-v1 — precisão, limites e contratos', () => {
  it('soma 0.1 e 0.2 sem ponto flutuante binário', () => {
    const result = calculatePricing({
      currency: 'BRL',
      components: [component('0.1'), component('0.2')],
      desiredMargin: '0',
    });
    expect(result.baseCost.exact).toBe('0.3');
    expect(result.suggestedPrice.commercial).toBe('0.30');
  });

  it('multiplica componentes fracionários antes de arredondar', () => {
    const result = calculatePricing({
      currency: 'BRL',
      components: [
        component('0.654321', '0.123456'),
        component('0.004'),
        component('0.004'),
      ],
      desiredMargin: '0',
    });
    expect(result.components[0].total).toEqual({
      exact: '0.080779853376',
      display: '0.08',
    });
    expect(result.baseCost.exact).toBe('0.088779853376');
    expect(result.minimumPrice.commercial).toBe('0.09');
  });

  it('não adiciona custos fixos ao custo-base e preserva origem consolidada', () => {
    const result = calculatePricing(
      complete({
        fixedCosts: {
          mode: 'MONTHLY',
          monthlyCost: '3000',
          averageRevenue: '15000',
          origin: 'FINANCIAL_AGGREGATE',
        },
      }),
    );
    expect(result.baseCost.exact).toBe('61.5');
    expect(result.fixedCosts.input?.origin).toBe('FINANCIAL_AGGREGATE');
    expect(result.fixedCosts.rate).toBe('0.2');
  });

  it('rateia frete pela quantidade consumida, inclusive fracionária', () => {
    const result = calculatePricing({
      currency: 'BRL',
      freight: {
        mode: 'ALLOCATED',
        totalCost: '120',
        quantity: '40',
        consumedQuantity: '2.5',
      },
      desiredMargin: '0',
    });
    expect(result.freight?.costPerLotUnit.exact).toBe('3');
    expect(result.freight?.total.exact).toBe('7.5');
    expect(result.baseCost.exact).toBe('7.5');
  });

  it('aceita frete manual sem parâmetros de rateio e permite custo fixo mensal zero', () => {
    const result = calculatePricing({
      currency: 'BRL',
      freight: { mode: 'MANUAL', unitCost: '0.015' },
      fixedCosts: {
        mode: 'MONTHLY',
        monthlyCost: '0',
        averageRevenue: '1',
        origin: 'MANUAL',
      },
      desiredMargin: '0',
    });
    expect(result.freight).toMatchObject({
      mode: 'MANUAL',
      total: { exact: '0.015', display: '0.02' },
    });
    expect(result.minimumPrice.commercial).toBe('0.02');
    expect(result.fixedCosts.rate).toBe('0');
  });

  it('usa minutos canônicos e mantém horas e tempo fracionários', () => {
    const result = calculatePricing({
      currency: 'BRL',
      labor: { monthlyCost: '300', productiveHours: '2.5', timeMinutes: '0.5' },
      desiredMargin: '0',
    });
    expect(result.labor?.costPerHour.exact).toBe('120');
    expect(result.labor?.costPerMinute.exact).toBe('2');
    expect(result.labor?.total.exact).toBe('1');
  });

  it('cancela dízimas de mão de obra, frete e custo fixo antes dos preços comerciais', () => {
    const result = calculatePricing({
      currency: 'BRL',
      labor: { monthlyCost: '20', productiveHours: '1', timeMinutes: '1' },
      freight: { mode: 'ALLOCATED', totalCost: '2', quantity: '3' },
      fixedCosts: {
        mode: 'MONTHLY',
        monthlyCost: '1',
        averageRevenue: '3',
        origin: 'MANUAL',
      },
      desiredMargin: '0',
      adoptedPrice: '1.50',
    });
    expect(result.baseCost.exact).toBe('1');
    expect(result.minimumPrice).toEqual({ exact: '1.5', commercial: '1.50' });
    expect(result.analysis.profit.exact).toBe('0');
    expect(result.analysis.effectiveMargin).toBe('0');
  });

  it('forma centavo exato mesmo com mão de obra periódica positiva', () => {
    const result = calculatePricing({
      currency: 'BRL',
      labor: { monthlyCost: '1', productiveHours: '3', timeMinutes: '180' },
      desiredMargin: '0',
    });
    expect(result.baseCost.exact).toBe('1');
    expect(result.suggestedPrice.commercial).toBe('1.00');
  });

  it('suporta mínimos documentados de escala monetária e percentual', () => {
    const result = calculatePricing({
      currency: 'BRL',
      components: [component('9999999999999.999999')],
      desiredMargin: '0.99999999',
    });
    expect(result.baseCost.exact).toBe('9999999999999.999999');
    expect(result.suggestedPrice.exact).toBe('999999999999999999900');
    expect(result.suggestedPrice.commercial).toBe('999999999999999999900.00');
    expect(result.analysis.effectiveMargin).toBe('0.99999999');
  });

  it('preserva produtos de grandes quantidades com seis casas', () => {
    const result = calculatePricing({
      currency: 'BRL',
      components: [component('9999999999999.999999', '9999999999999.999999')],
      desiredMargin: '0',
    });
    expect(result.baseCost.exact).toBe(
      '99999999999999999980000000.000000000001',
    );
    expect(result.suggestedPrice.commercial).toBe(
      '99999999999999999980000000.01',
    );
  });

  it('calcula divisor mensal próximo de zero sem subtração de taxa aproximada', () => {
    const result = calculatePricing({
      currency: 'BRL',
      components: [component('1')],
      fixedCosts: {
        mode: 'MONTHLY',
        monthlyCost: '9999999999999.999998',
        averageRevenue: '9999999999999.999999',
        origin: 'MANUAL',
      },
      desiredMargin: '0',
    });
    expect(result.minimumPrice.exact).toBe('9999999999999999999');
    expect(result.minimumPrice.commercial).toBe('9999999999999999999.00');
    expect(result.analysis.profit.exact).toBe('0');
  });

  it('arredonda mínimo para cima, enquanto valores informativos usam half-up', () => {
    const result = calculatePricing({
      currency: 'BRL',
      components: [component('0.001')],
      desiredMargin: '0',
    });
    expect(result.baseCost.display).toBe('0.00');
    expect(result.minimumPrice).toEqual({ exact: '0.001', commercial: '0.01' });
    expect(result.analysis.profit).toEqual({ exact: '0.009', display: '0.01' });
  });

  it.each([
    ['62.49', 'BELOW_MINIMUM'],
    ['62.50', 'COST_COVERAGE'],
    ['62.51', 'BELOW_DESIRED_MARGIN'],
    ['90.90', 'BELOW_DESIRED_MARGIN'],
    ['90.91', 'DESIRED_MARGIN_MET'],
    ['90.92', 'ABOVE_DESIRED_MARGIN'],
  ])(
    'classifica preço %s contra limites comerciais (%s)',
    (adoptedPrice, expected) => {
      const result = calculatePricing(simple({ adoptedPrice }));
      expect(result.analysis.classification).toBe(expected);
      expect(result.analysis.price).toBe(adoptedPrice);
    },
  );

  it('usa o preço mínimo comercial como cobertura com lucro residual de arredondamento', () => {
    const result = calculatePricing(complete({ adoptedPrice: '89.79' }));
    expect(result.analysis.classification).toBe('COST_COVERAGE');
    expect(result.analysis.profit.exact).toBe('0.00615');
  });

  it('não fabrica margem quando o preço adotado é zero', () => {
    const result = calculatePricing(simple({ adoptedPrice: '0' }));
    expect(result.adoptedPrice).toBe('0.00');
    expect(result.analysis.effectiveMargin).toBeNull();
    expect(result.analysis.profit.exact).toBe('-50');
    expect(result.analysis.classification).toBe('BELOW_MINIMUM');
  });

  it('representa margem e desconto inaplicáveis com null em custo zero', () => {
    const result = calculatePricing({ currency: 'BRL', desiredMargin: '0.2' });
    expect(result.minimumPrice.commercial).toBe('0.00');
    expect(result.suggestedPrice.commercial).toBe('0.00');
    expect(result.analysis.effectiveMargin).toBeNull();
    expect(result.maximumDiscountRate).toBeNull();
    expect(result.analysis.classification).toBe('COST_COVERAGE');
    expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/);
  });

  it('preserva ordem, memória e ausência de mutações entre cálculos', () => {
    const input = complete();
    const original = structuredClone(input);
    const result = calculatePricing(input);
    expect(input).toEqual(original);
    expect(calculatePricing(input)).toEqual(result);
    expect(result.components.map((item) => item.description)).toEqual([
      'Material',
      'Embalagem',
      'Perdas',
    ]);
    expect(result.analysis.deductions.map((item) => item.name)).toEqual([
      'Imposto',
      'Pagamento',
      'Comissão',
    ]);
    expect(result.labor).not.toBe(input.labor);
    expect(result.fixedCosts.input).not.toBe(input.fixedCosts);
    expect(result.components[0]).not.toBe(input.components![0]);
    expect(result.deductions[0]).not.toBe(input.deductions![0]);
    // Later catalog/input changes cannot mutate previously returned calculation data.
    const later = structuredClone(input);
    const changed = calculatePricing({
      ...later,
      components: [component('999')],
    });
    expect(changed.baseCost.exact).not.toBe(result.baseCost.exact);
    expect(result.baseCost.exact).toBe('61.5');
  });

  it('não modifica nem depende da configuração global de Decimal', () => {
    const before = {
      precision: Decimal.precision,
      rounding: Decimal.rounding,
      minE: Decimal.minE,
      maxE: Decimal.maxE,
    };
    const expected = calculatePricing(complete());
    try {
      Decimal.set({
        precision: 3,
        rounding: Decimal.ROUND_DOWN,
        minE: -2,
        maxE: 2,
      });
      expect(calculatePricing(complete())).toEqual(expected);
      expect(Decimal.precision).toBe(3);
      expect(Decimal.rounding).toBe(Decimal.ROUND_DOWN);
      expect(Decimal.minE).toBe(-2);
      expect(Decimal.maxE).toBe(2);
    } finally {
      Decimal.set(before);
    }
  });
});

describe('margin-divisor-v1 — entradas inválidas', () => {
  it.each([
    '',
    ' ',
    ' 1',
    '1 ',
    '1,25',
    '1e2',
    '0x10',
    'NaN',
    'Infinity',
    '-Infinity',
    '.1',
    '1.',
    '++1',
    '10000000000000',
    '0.0000001',
  ])('rejeita valor decimal %j', (unitCost) => {
    expectError(
      simple({ components: [component(unitCost)] }),
      'INVALID_DECIMAL_VALUE',
      'components[0].unitCost',
    );
  });

  it.each([1, Number.NaN, Number.POSITIVE_INFINITY, null, undefined])(
    'rejeita dinheiro não textual %j',
    (unitCost) => {
      expectError(
        simple({ components: [component(unitCost as unknown as string)] }),
        'INVALID_DECIMAL_VALUE',
        'components[0].unitCost',
      );
    },
  );

  it.each(['0.000000001', '10000'])(
    'rejeita percentual fora da precisão suportada %s',
    (desiredMargin) => {
      expectError(
        simple({ desiredMargin }),
        'INVALID_DECIMAL_VALUE',
        'desiredMargin',
      );
    },
  );

  it('rejeita preço adotado com fração de centavo em vez de arredondá-lo', () => {
    expectError(
      simple({ adoptedPrice: '90.911' }),
      'INVALID_DECIMAL_VALUE',
      'adoptedPrice',
    );
  });

  it.each([
    ['components[0].quantity', { components: [component('1', '-1')] }],
    ['components[0].unitCost', { components: [component('-1')] }],
    ['desiredMargin', { desiredMargin: '-0.01' }],
    ['adoptedPrice', { adoptedPrice: '-1' }],
    [
      'deductions[0].rate',
      {
        deductions: [
          { name: 'Taxa', category: 'OTHER', rate: '-0.01', origin: 'MANUAL' },
        ],
      },
    ],
    [
      'fixedCosts.rate',
      { fixedCosts: { mode: 'RATE', rate: '-0.1', origin: 'MANUAL' } },
    ],
    [
      'fixedCosts.monthlyCost',
      {
        fixedCosts: {
          mode: 'MONTHLY',
          monthlyCost: '-1',
          averageRevenue: '1',
          origin: 'MANUAL',
        },
      },
    ],
    [
      'fixedCosts.averageRevenue',
      {
        fixedCosts: {
          mode: 'MONTHLY',
          monthlyCost: '1',
          averageRevenue: '-1',
          origin: 'MANUAL',
        },
      },
    ],
    [
      'labor.monthlyCost',
      { labor: { monthlyCost: '-1', productiveHours: '1', timeMinutes: '1' } },
    ],
    [
      'labor.productiveHours',
      { labor: { monthlyCost: '1', productiveHours: '-1', timeMinutes: '1' } },
    ],
    [
      'labor.timeMinutes',
      { labor: { monthlyCost: '1', productiveHours: '1', timeMinutes: '-1' } },
    ],
    ['freight.unitCost', { freight: { mode: 'MANUAL', unitCost: '-1' } }],
    [
      'freight.totalCost',
      { freight: { mode: 'ALLOCATED', totalCost: '-1', quantity: '1' } },
    ],
    [
      'freight.quantity',
      { freight: { mode: 'ALLOCATED', totalCost: '1', quantity: '-1' } },
    ],
    [
      'freight.consumedQuantity',
      {
        freight: {
          mode: 'ALLOCATED',
          totalCost: '1',
          quantity: '1',
          consumedQuantity: '-1',
        },
      },
    ],
  ] satisfies readonly [string, Partial<PricingCalculatorInput>][])(
    'identifica negativo em %s',
    (field, overrides) => {
      expectError(simple(overrides), 'NEGATIVE_VALUE', field);
    },
  );

  it('rejeita divisor mínimo inválido mesmo com custo zero', () => {
    expectError(
      {
        currency: 'BRL',
        desiredMargin: '0',
        fixedCosts: { mode: 'RATE', rate: '1', origin: 'MANUAL' },
      },
      'INVALID_PRICING_DIVISOR',
    );
  });

  it('valida denominadores ativos mesmo com numerador zero', () => {
    expectError(
      {
        currency: 'BRL',
        desiredMargin: '0',
        fixedCosts: {
          mode: 'MONTHLY',
          monthlyCost: '0',
          averageRevenue: '0',
          origin: 'MANUAL',
        },
      },
      'INVALID_AVERAGE_REVENUE',
    );
    expectError(
      {
        currency: 'BRL',
        desiredMargin: '0',
        labor: { monthlyCost: '0', productiveHours: '0', timeMinutes: '0' },
      },
      'INVALID_PRODUCTIVE_HOURS',
    );
    expectError(
      {
        currency: 'BRL',
        desiredMargin: '0',
        freight: { mode: 'ALLOCATED', totalCost: '0', quantity: '0' },
      },
      'INVALID_FREIGHT_QUANTITY',
    );
  });

  it('não exige parâmetros de mão de obra/frete quando ausentes e aceita componentes zero', () => {
    const result = calculatePricing({
      currency: 'BRL',
      components: [component('0', '0')],
      desiredMargin: '0',
    });
    expect(result.baseCost.exact).toBe('0');
  });

  it('rejeita moeda diferente de BRL', () => {
    expectError(
      { currency: 'USD' as 'BRL', desiredMargin: '0' },
      'UNSUPPORTED_CURRENCY',
      'currency',
    );
  });
});
