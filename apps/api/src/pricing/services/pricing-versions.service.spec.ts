import type { PrismaService } from '../../database/prisma.service.js';
import { PricingErrorCode } from '../errors/pricing-http.exception.js';
import type { PricingCalculationsService } from './pricing-calculations.service.js';
import { PricingVersionsService } from './pricing-versions.service.js';

describe('PricingVersionsService', () => {
  const organizationId = '00000000-0000-4000-8000-000000000001';
  const actorUserId = '00000000-0000-4000-8000-000000000002';
  const productId = '00000000-0000-4000-8000-000000000003';
  const versionId = '00000000-0000-4000-8000-000000000004';
  const configurationId = '00000000-0000-4000-8000-000000000005';
  const versionNumberIndex =
    'pricing_calculation_versions_org_product_number_key';
  const prisma = {
    $transaction: vi.fn(),
    product: { findFirst: vi.fn() },
    organizationPricingConfiguration: { findUnique: vi.fn() },
    productPricingComposition: { findFirst: vi.fn() },
    pricingCalculationVersion: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };
  const calculations = { resolvePersistedInTransaction: vi.fn() };
  let service: PricingVersionsService;

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.organizationPricingConfiguration.findUnique.mockResolvedValue({
      id: configurationId,
      isActive: true,
      currentRevisionId: versionId,
    });
    prisma.productPricingComposition.findFirst.mockResolvedValue({
      profileId: null,
      components: [],
    });
    prisma.product.findFirst.mockResolvedValue({ id: productId });
    service = new PricingVersionsService(
      prisma as unknown as PrismaService,
      calculations as unknown as PricingCalculationsService,
    );
  });

  it('retries P2034 and returns the stable conflict after the bounded attempts', async () => {
    prisma.$transaction.mockRejectedValue({ code: 'P2034' });
    await expect(
      service.create(organizationId, actorUserId, productId, {
        expectedCompositionRevision: 1,
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: PricingErrorCode.PRICING_CONCURRENT_MODIFICATION },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  function uniqueConflict(
    index: string,
    modelName = 'PricingCalculationVersion',
  ) {
    return {
      code: 'P2002',
      meta: {
        modelName,
        driverAdapterError: {
          cause: { constraint: { index } },
        },
      },
    };
  }

  it('retries only the version-number unique index and returns the stable conflict', async () => {
    prisma.$transaction.mockRejectedValue(uniqueConflict(versionNumberIndex));
    await expect(
      service.create(organizationId, actorUserId, productId, {
        expectedCompositionRevision: 1,
      }),
    ).rejects.toMatchObject({
      response: { code: PricingErrorCode.PRICING_CONCURRENT_MODIFICATION },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it.each([
    'pricing_calculation_versions_pkey',
    'pricing_calculation_versions_org_id_key',
    'pricing_calculation_versions_org_product_id_key',
  ])('propagates P2002 from the unrelated version index %s', async (index) => {
    const failure = uniqueConflict(index);
    prisma.$transaction.mockRejectedValue(failure);
    await expect(
      service.create(organizationId, actorUserId, productId, {
        expectedCompositionRevision: 1,
      }),
    ).rejects.toBe(failure);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('propagates P2002 without sufficient constraint metadata', async () => {
    const failure = {
      code: 'P2002',
      meta: { modelName: 'PricingCalculationVersion' },
    };
    prisma.$transaction.mockRejectedValue(failure);
    await expect(
      service.create(organizationId, actorUserId, productId, {
        expectedCompositionRevision: 1,
      }),
    ).rejects.toBe(failure);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('propagates P2002 from another model even with the same index metadata', async () => {
    const failure = uniqueConflict(versionNumberIndex, 'AuditLog');
    prisma.$transaction.mockRejectedValue(failure);
    await expect(
      service.create(organizationId, actorUserId, productId, {
        expectedCompositionRevision: 1,
      }),
    ).rejects.toBe(failure);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('propagates generic P2028 as an unexpected failure', async () => {
    const failure = { code: 'P2028', message: 'Transaction API error' };
    prisma.$transaction.mockRejectedValue(failure);
    await expect(
      service.create(organizationId, actorUserId, productId, {
        expectedCompositionRevision: 1,
      }),
    ).rejects.toBe(failure);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('returns stable errors for absent and unfinished historical versions', async () => {
    prisma.pricingCalculationVersion.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.findOne(organizationId, productId, versionId),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: PricingErrorCode.PRICING_VERSION_NOT_FOUND },
    });

    prisma.pricingCalculationVersion.findFirst.mockResolvedValueOnce({
      state: 'BUILDING',
    });
    await expect(
      service.findOne(organizationId, productId, versionId),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: PricingErrorCode.PRICING_VERSION_NOT_FINALIZED },
    });
  });

  it('rejects unknown snapshots before returning historical details', async () => {
    prisma.pricingCalculationVersion.findFirst.mockResolvedValue({
      state: 'FINALIZED',
      snapshot: { snapshotSchemaVersion: 2 },
    });
    await expect(
      service.findOne(organizationId, productId, versionId),
    ).rejects.toThrow(/snapshot/);
  });

  it('lists only finalized versions with deterministic pagination and no snapshot', async () => {
    prisma.$transaction.mockResolvedValue([
      [
        {
          id: versionId,
          number: 2,
          finalizedAt: new Date('2026-10-08T12:00:00.000Z'),
          createdAt: new Date('2026-10-08T11:59:00.000Z'),
        },
      ],
      1,
    ]);
    const result = await service.findAll(organizationId, productId, {
      page: 2,
      pageSize: 5,
    });
    expect(result).toMatchObject({
      data: [{ id: versionId, number: 2 }],
      pagination: { page: 2, pageSize: 5, total: 1, totalPages: 1 },
    });
    expect(
      prisma.pricingCalculationVersion.findMany.mock.calls[0]![0],
    ).toMatchObject({
      where: { organizationId, productId, state: 'FINALIZED' },
      orderBy: [{ number: 'desc' }, { id: 'asc' }],
      skip: 5,
      take: 5,
    });
  });
});
