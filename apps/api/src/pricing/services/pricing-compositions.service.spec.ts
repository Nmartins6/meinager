import { Prisma } from '../../generated/prisma/client.js';
import {
  PricingComponentCategory,
  PricingComponentCostSource,
  PricingFreightMode,
} from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { PutPricingCompositionDto } from '../dto/pricing-composition.dto.js';
import { PricingErrorCode } from '../errors/pricing-http.exception.js';
import { PricingCompositionsService } from './pricing-compositions.service.js';

describe('PricingCompositionsService', () => {
  const organizationId = '00000000-0000-4000-8000-000000000001';
  const actorUserId = '00000000-0000-4000-8000-000000000002';
  const productId = '00000000-0000-4000-8000-000000000003';
  const sourceProductId = '00000000-0000-4000-8000-000000000004';
  const compositionId = '00000000-0000-4000-8000-000000000005';
  const now = new Date('2026-10-06T12:00:00.000Z');

  const component = {
    id: '00000000-0000-4000-8000-000000000006',
    position: 1,
    description: 'Material',
    category: PricingComponentCategory.MATERIAL,
    unit: 'UN',
    quantity: new Prisma.Decimal('2'),
    costSource: PricingComponentCostSource.MANUAL,
    storedUnitCost: new Prisma.Decimal('12.5'),
    sourceProductId: null,
    originDetails: {
      schemaVersion: 1,
      source: null,
      referenceId: null,
      periodStart: null,
      periodEnd: null,
      criterion: null,
      measuredAt: null,
      confirmedByUserId: actorUserId,
    },
    createdAt: now,
    updatedAt: now,
  };
  const composition = {
    id: compositionId,
    productId,
    revision: 1,
    profileId: null,
    desiredMargin: new Prisma.Decimal('0.25'),
    laborEnabled: false,
    timeMinutes: null,
    freightMode: null,
    freightUnitCost: null,
    freightTotalCost: null,
    freightQuantity: null,
    freightConsumedQuantity: null,
    parameterOrigins: {},
    isActive: true,
    createdAt: now,
    updatedAt: now,
    components: [component],
  };
  const transaction = {
    $queryRaw: vi.fn(),
    product: { findMany: vi.fn() },
    pricingSalesProfile: { findFirst: vi.fn() },
    productPricingComposition: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    pricingComponent: { createMany: vi.fn(), deleteMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(),
    product: { findFirst: vi.fn() },
    productPricingComposition: { findFirst: vi.fn() },
  };
  let service: PricingCompositionsService;

  const dto = (): PutPricingCompositionDto => ({
    expectedRevision: null,
    profileId: null,
    desiredMargin: '0.25000000',
    laborEnabled: false,
    timeMinutes: null,
    freightMode: null,
    freightUnitCost: null,
    freightTotalCost: null,
    freightQuantity: null,
    freightConsumedQuantity: null,
    parameterOrigins: {},
    components: [
      {
        description: 'Material',
        category: PricingComponentCategory.MATERIAL,
        unit: 'UN',
        quantity: '2.000000',
        costSource: PricingComponentCostSource.MANUAL,
        storedUnitCost: '12.500000',
      },
    ],
  });

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(transaction));
    transaction.$queryRaw.mockResolvedValue([{ id: productId }]);
    transaction.product.findMany.mockResolvedValue([
      { id: productId, unit: 'UN', directCost: null, isActive: true },
    ]);
    transaction.productPricingComposition.findFirst.mockResolvedValue(null);
    transaction.productPricingComposition.create.mockResolvedValue({
      id: compositionId,
    });
    transaction.productPricingComposition.findUniqueOrThrow.mockResolvedValue(
      composition,
    );
    transaction.pricingComponent.createMany.mockResolvedValue({ count: 1 });
    transaction.pricingComponent.deleteMany.mockResolvedValue({ count: 1 });
    transaction.auditLog.create.mockResolvedValue({});
    service = new PricingCompositionsService(
      prisma as unknown as PrismaService,
    );
  });

  it('creates revision one with canonical ordered components and atomic audit', async () => {
    const result = await service.replace(
      organizationId,
      actorUserId,
      productId,
      dto(),
    );

    expect(result.revision).toBe(1);
    expect(
      transaction.productPricingComposition.create.mock.calls[0]![0].data,
    ).toMatchObject({
      revision: 1,
      desiredMargin: '0.25',
      createdByUserId: actorUserId,
      updatedByUserId: actorUserId,
    });
    expect(
      transaction.pricingComponent.createMany.mock.calls[0]![0].data,
    ).toMatchObject([
      {
        position: 1,
        quantity: '2',
        storedUnitCost: '12.5',
        sourceProductId: null,
        originDetails: { confirmedByUserId: actorUserId },
      },
    ]);
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'product_pricing_composition.updated',
        metadata: {
          operation: 'CREATE',
          productId,
          previousRevision: null,
          newRevision: 1,
          profileId: null,
          componentCount: 1,
        },
      }),
    });
  });

  it('validates catalog products and never persists their current direct cost', async () => {
    transaction.product.findMany.mockResolvedValue([
      { id: productId, unit: 'UN', directCost: null, isActive: true },
      {
        id: sourceProductId,
        unit: 'KG',
        directCost: new Prisma.Decimal('9.75'),
        isActive: true,
      },
    ]);
    const input = dto();
    input.components = [
      {
        description: 'Insumo',
        category: PricingComponentCategory.MATERIAL,
        unit: 'KG',
        quantity: '3',
        costSource: PricingComponentCostSource.CATALOG,
        sourceProductId,
      },
    ];

    await service.replace(organizationId, actorUserId, productId, input);

    expect(
      transaction.pricingComponent.createMany.mock.calls[0]![0].data[0],
    ).toMatchObject({
      costSource: PricingComponentCostSource.CATALOG,
      sourceProductId,
      storedUnitCost: null,
    });
  });

  it('returns a semantic no-op without revision, component writes or audit', async () => {
    transaction.productPricingComposition.findFirst.mockResolvedValue(
      composition,
    );
    const input = dto();
    input.expectedRevision = 1;

    const result = await service.replace(
      organizationId,
      actorUserId,
      productId,
      input,
    );

    expect(result.revision).toBe(1);
    expect(transaction.productPricingComposition.update).not.toHaveBeenCalled();
    expect(transaction.pricingComponent.deleteMany).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it('replaces the complete component collection with exactly one revision increment', async () => {
    transaction.productPricingComposition.findFirst.mockResolvedValue(
      composition,
    );
    transaction.productPricingComposition.findUniqueOrThrow.mockResolvedValue({
      ...composition,
      revision: 2,
      components: [],
    });
    const input = dto();
    input.expectedRevision = 1;
    input.components = [];

    const result = await service.replace(
      organizationId,
      actorUserId,
      productId,
      input,
    );

    expect(result.revision).toBe(2);
    expect(transaction.productPricingComposition.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revision: 2 }),
      }),
    );
    expect(transaction.pricingComponent.deleteMany).toHaveBeenCalledOnce();
    expect(transaction.pricingComponent.createMany).not.toHaveBeenCalled();
    expect(
      transaction.auditLog.create.mock.calls[0]![0].data.metadata,
    ).toMatchObject({ previousRevision: 1, newRevision: 2, componentCount: 0 });
  });

  it('rejects a stale revision before any write', async () => {
    transaction.productPricingComposition.findFirst.mockResolvedValue(
      composition,
    );
    const input = dto();
    input.expectedRevision = 4;

    await expect(
      service.replace(organizationId, actorUserId, productId, input),
    ).rejects.toMatchObject({
      response: { code: PricingErrorCode.PRICING_REVISION_CONFLICT },
    });
    expect(transaction.productPricingComposition.update).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects incompatible component sources before persistence', async () => {
    const input = dto();
    input.components[0] = {
      ...input.components[0]!,
      costSource: PricingComponentCostSource.CATALOG,
      sourceProductId,
      storedUnitCost: null,
    };

    await expect(
      service.replace(organizationId, actorUserId, productId, input),
    ).rejects.toMatchObject({
      response: {
        code: PricingErrorCode.VALIDATION_ERROR,
        field: 'components.0.storedUnitCost',
      },
    });
    expect(transaction.productPricingComposition.create).not.toHaveBeenCalled();
  });

  it('validates labor and allocated freight states', async () => {
    const input = dto();
    input.laborEnabled = true;
    input.timeMinutes = '90';
    input.freightMode = PricingFreightMode.ALLOCATED;
    input.freightTotalCost = '120';
    input.freightQuantity = '0';

    await expect(
      service.replace(organizationId, actorUserId, productId, input),
    ).rejects.toMatchObject({
      response: { code: PricingErrorCode.INVALID_FREIGHT_QUANTITY },
    });
  });

  it('maps known Prisma write conflicts to the stable pricing conflict', async () => {
    prisma.$transaction.mockRejectedValue({ code: 'P2034' });
    await expect(
      service.replace(organizationId, actorUserId, productId, dto()),
    ).rejects.toMatchObject({
      response: { code: PricingErrorCode.PRICING_CONCURRENT_MODIFICATION },
    });
  });
});
