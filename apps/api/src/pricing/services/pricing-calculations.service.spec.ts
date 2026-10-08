import { Prisma } from '../../generated/prisma/client.js';
import {
  PricingComponentCategory,
  PricingComponentCostSource,
  PricingFixedCostMode,
  PricingFreightMode,
  PricingParameterOrigin,
} from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { CreatePricingSimulationDto } from '../dto/pricing-simulation.dto.js';
import { PricingErrorCode } from '../errors/pricing-http.exception.js';
import { PricingCalculationsService } from './pricing-calculations.service.js';

describe('PricingCalculationsService', () => {
  const organizationId = '00000000-0000-4000-8000-000000000001';
  const actorUserId = '00000000-0000-4000-8000-000000000002';
  const productId = '00000000-0000-4000-8000-000000000003';
  const sourceProductId = '00000000-0000-4000-8000-000000000004';
  const profileId = '00000000-0000-4000-8000-000000000005';
  const configurationId = '00000000-0000-4000-8000-000000000006';
  const configurationRevisionId = '00000000-0000-4000-8000-000000000007';
  const profileRevisionId = '00000000-0000-4000-8000-000000000008';

  const origin = (
    value: PricingParameterOrigin = PricingParameterOrigin.MANUAL,
  ) => ({
    schemaVersion: 1,
    origin: value,
  });
  const configuration = () => ({
    id: configurationId,
    isActive: true,
    currentRevision: {
      id: configurationRevisionId,
      revision: 2,
      currency: 'BRL',
      fixedCostMode: PricingFixedCostMode.RATE,
      fixedCostRate: new Prisma.Decimal('0.1'),
      monthlyFixedCost: null,
      averageMonthlyRevenue: null,
      monthlyLaborCost: new Prisma.Decimal('3200'),
      productiveHours: new Prisma.Decimal('160'),
      defaultDesiredMargin: new Prisma.Decimal('0.25'),
      parameterOrigins: {
        fixedCostMode: origin(),
        fixedCostRate: origin(),
        monthlyLaborCost: origin(),
        productiveHours: origin(),
        defaultDesiredMargin: origin(),
      },
    },
  });
  const composition = () => ({
    id: '00000000-0000-4000-8000-000000000009',
    revision: 3,
    profileId: null,
    desiredMargin: new Prisma.Decimal('0.25'),
    laborEnabled: false,
    timeMinutes: null,
    freightMode: null,
    freightUnitCost: null,
    freightTotalCost: null,
    freightQuantity: null,
    freightConsumedQuantity: null,
    parameterOrigins: { desiredMargin: origin() },
    isActive: true,
    components: [
      {
        position: 1,
        description: 'Material',
        category: PricingComponentCategory.MATERIAL,
        unit: 'UN',
        quantity: new Prisma.Decimal('2'),
        costSource: PricingComponentCostSource.MANUAL,
        storedUnitCost: new Prisma.Decimal('20'),
        sourceProductId: null,
      },
    ],
  });
  const profile = () => ({
    id: profileId,
    isActive: true,
    currentRevision: {
      id: profileRevisionId,
      revision: 4,
      name: 'Varejo',
      deductions: [
        {
          position: 1,
          name: 'Taxa',
          category: 'PAYMENT',
          rate: new Prisma.Decimal('0.05'),
          origin: PricingParameterOrigin.MANUAL,
        },
      ],
    },
  });
  const transaction = {
    product: { findFirst: vi.fn(), findMany: vi.fn() },
    organizationPricingConfiguration: { findUnique: vi.fn() },
    productPricingComposition: { findFirst: vi.fn() },
    pricingSalesProfile: { findFirst: vi.fn() },
  };
  const prisma = { $transaction: vi.fn() };
  let service: PricingCalculationsService;

  const persisted = (adoptedPrice?: string): CreatePricingSimulationDto => ({
    source: 'PERSISTED',
    ...(adoptedPrice === undefined ? {} : { adoptedPrice }),
  });
  const draft = (): CreatePricingSimulationDto => ({
    source: 'DRAFT',
    draft: {
      profileId: null,
      desiredMargin: '0.25',
      laborEnabled: false,
      timeMinutes: null,
      freightMode: null,
      freightUnitCost: null,
      freightTotalCost: null,
      freightQuantity: null,
      freightConsumedQuantity: null,
      parameterOrigins: { desiredMargin: { origin: 'MANUAL' } },
      components: [
        {
          description: 'Material',
          category: PricingComponentCategory.MATERIAL,
          unit: 'UN',
          quantity: '2',
          costSource: PricingComponentCostSource.MANUAL,
          storedUnitCost: '20',
        },
      ],
    },
  });

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(transaction));
    transaction.product.findFirst.mockResolvedValue({
      id: productId,
      unit: 'UN',
      directCost: new Prisma.Decimal('10'),
      isActive: true,
    });
    transaction.product.findMany.mockResolvedValue([]);
    transaction.organizationPricingConfiguration.findUnique.mockResolvedValue(
      configuration(),
    );
    transaction.productPricingComposition.findFirst.mockResolvedValue(
      composition(),
    );
    transaction.pricingSalesProfile.findFirst.mockResolvedValue(profile());
    service = new PricingCalculationsService(
      prisma as unknown as PrismaService,
    );
  });

  it('uses one REPEATABLE READ transaction and returns the persisted composition result', async () => {
    const result = await service.simulate(
      organizationId,
      actorUserId,
      productId,
      persisted(),
    );
    expect(prisma.$transaction.mock.calls[0]![1]).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
    expect(result).toMatchObject({
      productId,
      source: 'PERSISTED',
      compositionRevision: 3,
      formulaVersion: 'margin-divisor-v1',
      configuration: { revision: 2 },
      profile: null,
      effectiveDesiredMargin: {
        value: '0.25',
        precedence: 'COMPOSITION',
        origin: 'MANUAL',
      },
    });
    expect(result.resolvedInput.components).toEqual([
      expect.objectContaining({ quantity: '2', unitCost: '20' }),
    ]);
  });

  it('calculates a transient draft without reading or writing a composition', async () => {
    const result = await service.simulate(
      organizationId,
      actorUserId,
      productId,
      draft(),
    );
    expect(result.source).toBe('DRAFT');
    expect(result.compositionRevision).toBeNull();
    expect(
      transaction.productPricingComposition.findFirst,
    ).not.toHaveBeenCalled();
    expect(Object.keys(transaction)).not.toContain('auditLog');
  });

  it('resolves MANUAL, COPIED and current CATALOG costs in deterministic order', async () => {
    const base = composition();
    const record = {
      ...base,
      components: [
        base.components[0]!,
        {
          ...base.components[0]!,
          position: 2,
          description: 'Copied',
          costSource: PricingComponentCostSource.COPIED,
          storedUnitCost: new Prisma.Decimal('5'),
        },
        {
          ...base.components[0]!,
          position: 3,
          description: 'Catalog',
          unit: 'KG',
          costSource: PricingComponentCostSource.CATALOG,
          storedUnitCost: null,
          sourceProductId,
        },
      ],
    };
    transaction.productPricingComposition.findFirst.mockResolvedValue(record);
    transaction.product.findMany.mockResolvedValue([
      {
        id: sourceProductId,
        unit: 'KG',
        directCost: new Prisma.Decimal('0.000001'),
        isActive: true,
      },
    ]);
    const result = await service.simulate(
      organizationId,
      actorUserId,
      productId,
      persisted(),
    );
    expect(result.resolvedInput.components!.map((item) => item.origin)).toEqual(
      ['MANUAL', 'COPIED', 'CATALOG'],
    );
    expect(result.resolvedInput.components![2]).toMatchObject({
      unitCost: '0.000001',
      productId: sourceProductId,
    });
    expect(JSON.stringify(result)).not.toMatch(/[eE]-6/);
  });

  it('serializes the smallest persisted rate without exponent notation', async () => {
    const config = configuration();
    config.currentRevision.fixedCostRate = new Prisma.Decimal('0.00000001');
    transaction.organizationPricingConfiguration.findUnique.mockResolvedValue(
      config,
    );
    const result = await service.simulate(
      organizationId,
      actorUserId,
      productId,
      persisted(),
    );
    expect(result.resolvedInput.fixedCosts).toMatchObject({
      rate: '0.00000001',
    });
    expect(JSON.stringify(result)).not.toMatch(/[eE]-8/);
  });

  it('applies a profile with ordered deductions and an adopted price analysis', async () => {
    const record = { ...composition(), profileId };
    transaction.productPricingComposition.findFirst.mockResolvedValue(record);
    const result = await service.simulate(
      organizationId,
      actorUserId,
      productId,
      persisted('60.00'),
    );
    expect(result.profile).toMatchObject({ id: profileId, revision: 4 });
    expect(result.resolvedInput.deductions).toEqual([
      expect.objectContaining({ name: 'Taxa', rate: '0.05' }),
    ]);
    expect(result.adoptedPrice).toBe('60.00');
    expect(result.result.analysis.price).toBe('60.00');
  });

  it('uses the configuration margin and supports monthly fixed costs, labor and allocated freight', async () => {
    const baseConfig = configuration();
    const config = {
      ...baseConfig,
      currentRevision: {
        ...baseConfig.currentRevision,
        fixedCostMode: PricingFixedCostMode.MONTHLY,
        fixedCostRate: null,
        monthlyFixedCost: new Prisma.Decimal('1000'),
        averageMonthlyRevenue: new Prisma.Decimal('10000'),
        parameterOrigins: {
          ...baseConfig.currentRevision.parameterOrigins,
          monthlyFixedCost: origin(PricingParameterOrigin.FINANCIAL_AGGREGATE),
          averageMonthlyRevenue: origin(
            PricingParameterOrigin.FINANCIAL_AGGREGATE,
          ),
        },
      },
    };
    transaction.organizationPricingConfiguration.findUnique.mockResolvedValue(
      config,
    );
    const record = {
      ...composition(),
      desiredMargin: null,
      laborEnabled: true,
      timeMinutes: new Prisma.Decimal('30'),
      freightMode: PricingFreightMode.ALLOCATED,
      freightTotalCost: new Prisma.Decimal('100'),
      freightQuantity: new Prisma.Decimal('10'),
      freightConsumedQuantity: null,
    };
    transaction.productPricingComposition.findFirst.mockResolvedValue(record);
    const result = await service.simulate(
      organizationId,
      actorUserId,
      productId,
      persisted(),
    );
    expect(result.effectiveDesiredMargin).toMatchObject({
      value: '0.25',
      precedence: 'CONFIGURATION',
      origin: 'MANUAL',
    });
    expect(result.resolvedInput.fixedCosts).toMatchObject({
      mode: 'MONTHLY',
      monthlyCost: '1000',
      averageRevenue: '10000',
      origin: 'FINANCIAL_AGGREGATE',
    });
    expect(result.resolvedInput.labor).toBeDefined();
    expect(result.resolvedInput.freight).toEqual({
      mode: 'ALLOCATED',
      totalCost: '100',
      quantity: '10',
    });
    expect(result.result.freight?.mode).toBe('ALLOCATED');
    if (result.result.freight?.mode !== 'ALLOCATED') {
      throw new Error('Expected allocated freight');
    }
    expect(result.result.freight.consumedQuantity).toBe('1');
  });

  it('omits labor, freight and deductions when they are not selected', async () => {
    const result = await service.simulate(
      organizationId,
      actorUserId,
      productId,
      persisted(),
    );
    expect(result.resolvedInput.labor).toBeUndefined();
    expect(result.resolvedInput.freight).toBeUndefined();
    expect(result.resolvedInput.deductions).toEqual([]);
  });

  it('adapts manual freight without creating a second calculation path', async () => {
    const input = draft();
    input.draft = {
      ...input.draft!,
      freightMode: PricingFreightMode.MANUAL,
      freightUnitCost: '3.5',
    };
    const result = await service.simulate(
      organizationId,
      actorUserId,
      productId,
      input,
    );
    expect(result.resolvedInput.freight).toEqual({
      mode: 'MANUAL',
      unitCost: '3.5',
    });
    expect(result.result.freight).toMatchObject({
      mode: 'MANUAL',
      total: { exact: '3.5' },
    });
  });

  it('translates typed calculator failures to stable HTTP errors', async () => {
    const config = configuration();
    config.currentRevision.fixedCostRate = new Prisma.Decimal('0.75');
    transaction.organizationPricingConfiguration.findUnique.mockResolvedValue(
      config,
    );
    await expect(
      service.simulate(organizationId, actorUserId, productId, persisted()),
    ).rejects.toMatchObject({
      response: { code: PricingErrorCode.INVALID_PRICING_DIVISOR },
    });

    const baseConfig = configuration();
    transaction.organizationPricingConfiguration.findUnique.mockResolvedValue({
      ...baseConfig,
      currentRevision: {
        ...baseConfig.currentRevision,
        fixedCostMode: PricingFixedCostMode.MONTHLY,
        fixedCostRate: null,
        monthlyFixedCost: new Prisma.Decimal('100'),
        averageMonthlyRevenue: new Prisma.Decimal('0'),
        parameterOrigins: {
          ...baseConfig.currentRevision.parameterOrigins,
          monthlyFixedCost: origin(),
        },
      },
    });
    await expect(
      service.simulate(organizationId, actorUserId, productId, persisted()),
    ).rejects.toMatchObject({
      response: { code: PricingErrorCode.INVALID_AVERAGE_REVENUE },
    });
  });

  it('maps absent organization resources without leaking foreign records', async () => {
    transaction.product.findFirst.mockResolvedValue(null);
    await expect(
      service.simulate(organizationId, actorUserId, productId, persisted()),
    ).rejects.toMatchObject({
      response: { code: PricingErrorCode.PRODUCT_NOT_FOUND },
    });
  });

  it('requires configuration and an active profile when referenced', async () => {
    transaction.organizationPricingConfiguration.findUnique.mockResolvedValue(
      null,
    );
    await expect(
      service.simulate(organizationId, actorUserId, productId, persisted()),
    ).rejects.toMatchObject({
      response: { code: PricingErrorCode.PRICING_CONFIGURATION_REQUIRED },
    });

    transaction.organizationPricingConfiguration.findUnique.mockResolvedValue(
      configuration(),
    );
    const record = { ...composition(), profileId };
    transaction.productPricingComposition.findFirst.mockResolvedValue(record);
    transaction.pricingSalesProfile.findFirst.mockResolvedValue({
      ...profile(),
      isActive: false,
    });
    await expect(
      service.simulate(organizationId, actorUserId, productId, persisted()),
    ).rejects.toMatchObject({
      response: { code: PricingErrorCode.PRICING_PROFILE_INACTIVE },
    });
  });

  it('does not invoke any mutation or audit API', async () => {
    await service.simulate(organizationId, actorUserId, productId, persisted());
    expect(transaction.product.findFirst).toHaveBeenCalledOnce();
    expect(transaction.product.findMany).not.toHaveBeenCalled();
    expect(Object.keys(transaction)).toEqual([
      'product',
      'organizationPricingConfiguration',
      'productPricingComposition',
      'pricingSalesProfile',
    ]);
  });

  it('maps only Prisma P2034 to the stable concurrent modification conflict', async () => {
    prisma.$transaction.mockRejectedValue({ code: 'P2034' });

    const error = await service
      .simulate(organizationId, actorUserId, productId, persisted())
      .catch((failure: unknown) => failure);

    expect(error).toMatchObject({
      status: 409,
      response: {
        statusCode: 409,
        code: PricingErrorCode.PRICING_CONCURRENT_MODIFICATION,
      },
    });
  });

  it('propagates a generic Prisma P2028 as an unexpected failure', async () => {
    const failure = {
      code: 'P2028',
      message: 'Transaction API error',
    };
    prisma.$transaction.mockRejectedValue(failure);

    await expect(
      service.simulate(organizationId, actorUserId, productId, persisted()),
    ).rejects.toBe(failure);
  });

  it('rejects a draft with PERSISTED before opening a transaction', async () => {
    await expect(
      service.simulate(organizationId, actorUserId, productId, {
        ...persisted(),
        draft: draft().draft,
      }),
    ).rejects.toMatchObject({
      response: {
        statusCode: 400,
        code: PricingErrorCode.VALIDATION_ERROR,
      },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
