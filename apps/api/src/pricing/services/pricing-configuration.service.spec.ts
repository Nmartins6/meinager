import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PricingFixedCostMode } from '../../generated/prisma/enums.js';
import { PricingErrorCode } from '../errors/pricing-http.exception.js';
import { PricingConfigurationService } from './pricing-configuration.service.js';

describe('PricingConfigurationService', () => {
  const organizationId = '781282d6-3151-459d-8a4b-390174ea7646';
  const actorUserId = '85dac119-ee81-44cd-bc0b-7481e26b685b';
  const previousActorUserId = 'e03d3bed-d562-45ce-a9a5-17cc41ade990';
  const configurationId = '2fe57935-96bb-42f3-92b2-d31f5c0dbdd9';
  const revisionId = '596bfa57-f545-4e3e-8558-7c87f8772464';
  const now = new Date('2026-10-05T12:00:00.000Z');

  function persistedOrigin(confirmedByUserId = previousActorUserId) {
    return {
      schemaVersion: 1,
      origin: 'MANUAL',
      source: null,
      referenceId: null,
      periodStart: null,
      periodEnd: null,
      criterion: null,
      measuredAt: null,
      confirmedByUserId,
    };
  }

  const inputOrigin = { origin: 'MANUAL' as const };

  const revision = {
    id: revisionId,
    revision: 1,
    effectiveFrom: now,
    currency: 'BRL',
    fixedCostMode: PricingFixedCostMode.RATE,
    fixedCostRate: new Prisma.Decimal('0.125'),
    monthlyFixedCost: null,
    averageMonthlyRevenue: null,
    monthlyLaborCost: new Prisma.Decimal('1200.125'),
    productiveHours: new Prisma.Decimal('160'),
    defaultDesiredMargin: new Prisma.Decimal('0.25'),
    parameterOrigins: {
      fixedCostMode: persistedOrigin(),
      fixedCostRate: persistedOrigin(),
      monthlyLaborCost: persistedOrigin(),
      productiveHours: persistedOrigin(),
      defaultDesiredMargin: persistedOrigin(),
    },
    createdAt: now,
  };

  const configuration = {
    id: configurationId,
    isActive: true,
    currentRevision: revision,
  };

  const transaction = {
    $queryRaw: vi.fn(),
    organizationPricingConfiguration: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    organizationPricingConfigurationRevision: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };

  const prismaMock = {
    organizationPricingConfiguration: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  let service: PricingConfigurationService;

  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );
    transaction.$queryRaw.mockResolvedValue([{ id: configurationId }]);
    transaction.auditLog.create.mockResolvedValue({});
    service = new PricingConfigurationService(
      prismaMock as unknown as PrismaService,
    );
  });

  it('returns the current revision with explicit decimal strings', async () => {
    prismaMock.organizationPricingConfiguration.findUnique.mockResolvedValue(
      configuration,
    );

    await expect(service.findCurrent(organizationId)).resolves.toEqual({
      id: configurationId,
      isActive: true,
      currentRevision: {
        id: revisionId,
        revision: 1,
        effectiveFrom: now.toISOString(),
        currency: 'BRL',
        fixedCostMode: PricingFixedCostMode.RATE,
        fixedCostRate: '0.125',
        monthlyFixedCost: null,
        averageMonthlyRevenue: null,
        monthlyLaborCost: '1200.125',
        productiveHours: '160',
        defaultDesiredMargin: '0.25',
        parameterOrigins: revision.parameterOrigins,
        createdAt: now.toISOString(),
      },
    });

    expect(
      prismaMock.organizationPricingConfiguration.findUnique,
    ).toHaveBeenCalledWith({
      where: { organizationId },
      select: expect.any(Object),
    });
  });

  it('returns the stable not-found error when configuration is absent', async () => {
    prismaMock.organizationPricingConfiguration.findUnique.mockResolvedValue(
      null,
    );

    await expect(service.findCurrent(organizationId)).rejects.toMatchObject({
      status: 404,
      response: {
        code: PricingErrorCode.PRICING_CONFIGURATION_NOT_FOUND,
      },
    });
  });

  it('creates root, first immutable revision, pointer and audit atomically', async () => {
    transaction.organizationPricingConfiguration.findUnique.mockResolvedValue(
      null,
    );
    transaction.organizationPricingConfiguration.create.mockResolvedValue({
      id: configurationId,
    });
    transaction.organizationPricingConfigurationRevision.create.mockResolvedValue(
      { id: revisionId },
    );
    transaction.organizationPricingConfiguration.update.mockResolvedValue(
      configuration,
    );

    const result = await service.update(organizationId, actorUserId, {
      expectedRevision: null,
      fixedCostMode: PricingFixedCostMode.RATE,
      fixedCostRate: '0.125',
      monthlyLaborCost: '1200.125',
      productiveHours: '160',
      defaultDesiredMargin: '0.25',
      parameterOrigins: {
        fixedCostMode: inputOrigin,
        fixedCostRate: inputOrigin,
        monthlyLaborCost: inputOrigin,
        productiveHours: inputOrigin,
        defaultDesiredMargin: inputOrigin,
      },
    });

    expect(
      transaction.organizationPricingConfiguration.create,
    ).toHaveBeenCalled();
    expect(
      transaction.organizationPricingConfigurationRevision.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          revision: 1,
          fixedCostRate: '0.125',
          createdByUserId: actorUserId,
        }),
      }),
    );
    expect(transaction.auditLog.create).toHaveBeenCalledOnce();
    expect(result.currentRevision.revision).toBe(1);
  });

  it('rejects a stale expected revision before creating data or audit', async () => {
    transaction.organizationPricingConfiguration.findUnique.mockResolvedValue(
      configuration,
    );

    await expect(
      service.update(organizationId, actorUserId, {
        expectedRevision: 7,
        defaultDesiredMargin: '0.3',
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        code: PricingErrorCode.PRICING_REVISION_CONFLICT,
        details: { expectedRevision: 7, currentRevision: 1 },
      },
    });

    expect(
      transaction.organizationPricingConfigurationRevision.create,
    ).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it('creates a new revision instead of changing the current one', async () => {
    const secondRevision = {
      ...revision,
      id: '7f70f090-44b5-4114-8881-f45e87a0a54e',
      revision: 2,
      defaultDesiredMargin: new Prisma.Decimal('0.3'),
    };
    transaction.organizationPricingConfiguration.findUnique.mockResolvedValue(
      configuration,
    );
    transaction.organizationPricingConfigurationRevision.create.mockResolvedValue(
      { id: secondRevision.id },
    );
    transaction.organizationPricingConfiguration.update.mockResolvedValue({
      ...configuration,
      currentRevision: secondRevision,
    });

    const result = await service.update(organizationId, actorUserId, {
      expectedRevision: 1,
      defaultDesiredMargin: '0.3',
      parameterOrigins: { defaultDesiredMargin: inputOrigin },
    });

    expect(
      transaction.organizationPricingConfigurationRevision.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          revision: 2,
          fixedCostRate: '0.125',
          defaultDesiredMargin: '0.3',
          parameterOrigins: expect.objectContaining({
            fixedCostRate: persistedOrigin(),
            defaultDesiredMargin: persistedOrigin(actorUserId),
          }),
        }),
      }),
    );
    expect(
      transaction.organizationPricingConfiguration.update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentRevisionId: secondRevision.id,
        }),
      }),
    );
    expect(result.currentRevision.revision).toBe(2);
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          changedFields: ['defaultDesiredMargin', 'parameterOrigins'],
        }),
      }),
    });
  });

  it('rejects a changed value without matching provenance', async () => {
    transaction.organizationPricingConfiguration.findUnique.mockResolvedValue(
      configuration,
    );

    await expect(
      service.update(organizationId, actorUserId, {
        expectedRevision: 1,
        defaultDesiredMargin: '0.3',
      }),
    ).rejects.toMatchObject({
      status: 400,
      response: {
        code: PricingErrorCode.VALIDATION_ERROR,
        field: 'parameterOrigins.defaultDesiredMargin',
      },
    });

    expect(
      transaction.organizationPricingConfigurationRevision.create,
    ).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it('removes provenance when labor values become null', async () => {
    const withoutLabor = {
      ...revision,
      id: '3647f613-a8a9-48a2-9c7f-85617df89183',
      revision: 2,
      monthlyLaborCost: null,
      productiveHours: null,
      parameterOrigins: {
        fixedCostMode: persistedOrigin(),
        fixedCostRate: persistedOrigin(),
        defaultDesiredMargin: persistedOrigin(),
      },
    };
    transaction.organizationPricingConfiguration.findUnique.mockResolvedValue(
      configuration,
    );
    transaction.organizationPricingConfigurationRevision.create.mockResolvedValue(
      { id: withoutLabor.id },
    );
    transaction.organizationPricingConfiguration.update.mockResolvedValue({
      ...configuration,
      currentRevision: withoutLabor,
    });

    await service.update(organizationId, actorUserId, {
      expectedRevision: 1,
      monthlyLaborCost: null,
      productiveHours: null,
    });

    const revisionData =
      transaction.organizationPricingConfigurationRevision.create.mock
        .calls[0]![0].data;
    expect(revisionData.parameterOrigins).not.toHaveProperty(
      'monthlyLaborCost',
    );
    expect(revisionData.parameterOrigins).not.toHaveProperty('productiveHours');
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          changedFields: [
            'monthlyLaborCost',
            'productiveHours',
            'parameterOrigins',
          ],
        }),
      }),
    });
  });

  it('normalizes equivalent decimals and identical payloads as no-op', async () => {
    transaction.organizationPricingConfiguration.findUnique.mockResolvedValue(
      configuration,
    );

    const equivalent = await service.update(organizationId, actorUserId, {
      expectedRevision: 1,
      fixedCostRate: '0.12500000',
    });
    const identical = await service.update(organizationId, actorUserId, {
      expectedRevision: 1,
    });

    expect(equivalent.currentRevision.revision).toBe(1);
    expect(identical.currentRevision.revision).toBe(1);
    expect(
      transaction.organizationPricingConfigurationRevision.create,
    ).not.toHaveBeenCalled();
    expect(
      transaction.organizationPricingConfiguration.update,
    ).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it('compares provenance deterministically without changing its confirmer', async () => {
    const shuffledOrigin = {
      confirmedByUserId: previousActorUserId,
      measuredAt: null,
      criterion: null,
      periodEnd: null,
      periodStart: null,
      referenceId: null,
      source: null,
      origin: 'MANUAL',
      schemaVersion: 1,
    };
    transaction.organizationPricingConfiguration.findUnique.mockResolvedValue({
      ...configuration,
      currentRevision: {
        ...revision,
        parameterOrigins: {
          ...revision.parameterOrigins,
          fixedCostRate: shuffledOrigin,
        },
      },
    });

    await service.update(organizationId, previousActorUserId, {
      expectedRevision: 1,
      parameterOrigins: { fixedCostRate: inputOrigin },
    });

    expect(
      transaction.organizationPricingConfigurationRevision.create,
    ).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects provenance for an absent or incompatible parameter', async () => {
    transaction.organizationPricingConfiguration.findUnique.mockResolvedValue(
      configuration,
    );

    await expect(
      service.update(organizationId, actorUserId, {
        expectedRevision: 1,
        parameterOrigins: { monthlyFixedCost: inputOrigin },
      }),
    ).rejects.toMatchObject({
      response: {
        code: PricingErrorCode.VALIDATION_ERROR,
        field: 'parameterOrigins.monthlyFixedCost',
      },
    });
  });

  it('removes RATE origins and requires new MONTHLY origins when switching mode', async () => {
    const monthlyRevision = {
      ...revision,
      id: '7236e83e-5da7-485f-b516-926d9e1891ad',
      revision: 2,
      fixedCostMode: PricingFixedCostMode.MONTHLY,
      fixedCostRate: null,
      monthlyFixedCost: new Prisma.Decimal('1000'),
      averageMonthlyRevenue: new Prisma.Decimal('5000'),
      parameterOrigins: {
        fixedCostMode: persistedOrigin(actorUserId),
        monthlyFixedCost: persistedOrigin(actorUserId),
        averageMonthlyRevenue: persistedOrigin(actorUserId),
        monthlyLaborCost: persistedOrigin(),
        productiveHours: persistedOrigin(),
        defaultDesiredMargin: persistedOrigin(),
      },
    };
    transaction.organizationPricingConfiguration.findUnique.mockResolvedValue(
      configuration,
    );
    transaction.organizationPricingConfigurationRevision.create.mockResolvedValue(
      { id: monthlyRevision.id },
    );
    transaction.organizationPricingConfiguration.update.mockResolvedValue({
      ...configuration,
      currentRevision: monthlyRevision,
    });

    await service.update(organizationId, actorUserId, {
      expectedRevision: 1,
      fixedCostMode: PricingFixedCostMode.MONTHLY,
      monthlyFixedCost: '1000',
      averageMonthlyRevenue: '5000',
      parameterOrigins: {
        fixedCostMode: inputOrigin,
        monthlyFixedCost: inputOrigin,
        averageMonthlyRevenue: inputOrigin,
      },
    });

    const data =
      transaction.organizationPricingConfigurationRevision.create.mock
        .calls[0]![0].data;
    expect(data.fixedCostRate).toBeNull();
    expect(data.parameterOrigins).not.toHaveProperty('fixedCostRate');
    expect(data.parameterOrigins).toMatchObject({
      monthlyFixedCost: persistedOrigin(actorUserId),
      averageMonthlyRevenue: persistedOrigin(actorUserId),
      monthlyLaborCost: persistedOrigin(),
    });
  });

  it('removes MONTHLY origins when switching back to RATE', async () => {
    const monthlyRevision = {
      ...revision,
      fixedCostMode: PricingFixedCostMode.MONTHLY,
      fixedCostRate: null,
      monthlyFixedCost: new Prisma.Decimal('1000'),
      averageMonthlyRevenue: new Prisma.Decimal('5000'),
      parameterOrigins: {
        fixedCostMode: persistedOrigin(),
        monthlyFixedCost: persistedOrigin(),
        averageMonthlyRevenue: persistedOrigin(),
        monthlyLaborCost: persistedOrigin(),
        productiveHours: persistedOrigin(),
        defaultDesiredMargin: persistedOrigin(),
      },
    };
    transaction.organizationPricingConfiguration.findUnique.mockResolvedValue({
      ...configuration,
      currentRevision: monthlyRevision,
    });
    transaction.organizationPricingConfigurationRevision.create.mockResolvedValue(
      { id: 'af644923-2a5b-4b90-a815-ab1ac4ac0ca2' },
    );
    transaction.organizationPricingConfiguration.update.mockResolvedValue(
      configuration,
    );

    await service.update(organizationId, actorUserId, {
      expectedRevision: 1,
      fixedCostMode: PricingFixedCostMode.RATE,
      fixedCostRate: '0.2',
      parameterOrigins: {
        fixedCostMode: inputOrigin,
        fixedCostRate: inputOrigin,
      },
    });

    const origins =
      transaction.organizationPricingConfigurationRevision.create.mock
        .calls[0]![0].data.parameterOrigins;
    expect(origins).not.toHaveProperty('monthlyFixedCost');
    expect(origins).not.toHaveProperty('averageMonthlyRevenue');
    expect(origins).toMatchObject({
      fixedCostMode: persistedOrigin(actorUserId),
      fixedCostRate: persistedOrigin(actorUserId),
    });
  });

  it('rejects invalid conditional fixed-cost and labor states', async () => {
    transaction.organizationPricingConfiguration.findUnique.mockResolvedValue(
      null,
    );

    await expect(
      service.update(organizationId, actorUserId, {
        expectedRevision: null,
        fixedCostMode: PricingFixedCostMode.MONTHLY,
        monthlyFixedCost: '1000',
        averageMonthlyRevenue: '0',
      }),
    ).rejects.toMatchObject({
      response: { code: PricingErrorCode.INVALID_AVERAGE_REVENUE },
    });

    await expect(
      service.update(organizationId, actorUserId, {
        expectedRevision: null,
        monthlyLaborCost: '1000',
      }),
    ).rejects.toMatchObject({
      response: { code: PricingErrorCode.VALIDATION_ERROR },
    });

    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it('maps known transaction races without exposing Prisma codes', async () => {
    prismaMock.$transaction.mockRejectedValueOnce({ code: 'P2034' });

    await expect(
      service.update(organizationId, actorUserId, {
        expectedRevision: null,
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        code: PricingErrorCode.PRICING_CONCURRENT_MODIFICATION,
      },
    });
  });
});
