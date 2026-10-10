import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { OrganizationRole, ProductType } from '../generated/prisma/enums.js';
import { PricingErrorCode } from '../pricing/errors/pricing-http.exception.js';
import { ProductsService } from './products.service.js';

describe('ProductsService', () => {
  const organizationId = '9173bea8-0d7d-45ec-a08d-d1cbac34ceaf';
  const actorUserId = '53a6ba71-77b9-4aca-9493-e08e7dd11b83';
  const productId = '95b5f7b1-cbc5-4eb8-9d8c-e34fd71da87f';

  const existingProduct = {
    id: productId,
    type: ProductType.PRODUCT,
    name: 'Papel',
    sku: 'PAPEL-01',
    barcode: null,
    unit: 'UN',
    directCost: new Prisma.Decimal('0.125'),
    trackInventory: true,
    minimumStock: new Prisma.Decimal('5'),
    notes: null,
    isActive: true,
    createdAt: new Date('2026-09-05T12:00:00.000Z'),
    updatedAt: new Date('2026-09-05T12:00:00.000Z'),
    salePrice: new Prisma.Decimal('19.90'),
    adoptedPricingVersionId: null,
  };

  const transaction = {
    $queryRaw: vi.fn(),
    product: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    stockMovement: {
      findFirst: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };

  const prismaMock = {
    $transaction: vi.fn(),
    product: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };

  let service: ProductsService;

  beforeEach(async () => {
    vi.resetAllMocks();

    transaction.$queryRaw.mockResolvedValue([{ id: productId }]);
    transaction.stockMovement.findFirst.mockResolvedValue(null);

    prismaMock.$transaction.mockImplementation(
      async (
        operation:
          ((tx: typeof transaction) => Promise<unknown>) | Promise<unknown>[],
      ) =>
        typeof operation === 'function'
          ? operation(transaction)
          : Promise.all(operation),
    );

    transaction.product.findFirst.mockResolvedValue(existingProduct);
    transaction.auditLog.create.mockResolvedValue({});
    prismaMock.product.findFirst.mockResolvedValue(existingProduct);
    prismaMock.product.findMany.mockResolvedValue([existingProduct]);
    prismaMock.product.count.mockResolvedValue(1);

    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get(ProductsService);
  });

  it('should reject inventory tracking for a service', async () => {
    await expect(
      service.create(organizationId, actorUserId, {
        type: ProductType.SERVICE,
        name: 'Consultoria',
        unit: 'HORA',
        trackInventory: true,
      }),
    ).rejects.toThrow('Serviços não podem controlar estoque.');

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('should reject minimum stock without inventory tracking', async () => {
    await expect(
      service.create(organizationId, actorUserId, {
        name: 'Papel',
        unit: 'UN',
        trackInventory: false,
        minimumStock: '5',
      }),
    ).rejects.toThrow(
      'O estoque mínimo exige que o controle de estoque esteja habilitado.',
    );

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('should reject an empty update', async () => {
    await expect(
      service.update(
        organizationId,
        actorUserId,
        OrganizationRole.OWNER,
        productId,
        {},
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('should clear minimum stock when inventory tracking is disabled', async () => {
    const updatedProduct = {
      ...existingProduct,
      trackInventory: false,
      minimumStock: null,
    };

    transaction.product.update.mockResolvedValue(updatedProduct);

    const result = await service.update(
      organizationId,
      actorUserId,
      OrganizationRole.OWNER,
      productId,
      {
        trackInventory: false,
      },
    );

    expect(transaction.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: productId,
          organizationId,
        },
      }),
    );

    expect(transaction.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          trackInventory: false,
          minimumStock: null,
        }),
      }),
    );

    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId,
        actorUserId,
        action: 'product.updated',
        entityType: 'product',
        entityId: productId,
      },
    });

    expect(result.trackInventory).toBe(false);
    expect(result.minimumStock).toBeNull();
  });

  it('should update sale price even when stock history exists', async () => {
    transaction.stockMovement.findFirst.mockResolvedValue({
      id: 'ff7e2b0c-a8d5-4f91-bb63-3e751754dfe4',
    });

    transaction.product.update.mockResolvedValue({
      ...existingProduct,
      salePrice: new Prisma.Decimal('29.90'),
    });

    const result = await service.update(
      organizationId,
      actorUserId,
      OrganizationRole.OWNER,
      productId,
      {
        salePrice: '29.90',
      },
    );

    expect(transaction.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          salePrice: '29.90',
          adoptedPricingVersionId: null,
        }),
      }),
    );

    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId,
        actorUserId,
        action: 'product_price.manually_changed',
        entityType: 'product',
        entityId: productId,
        metadata: {
          productId,
          previousPrice: '19.9',
          newPrice: '29.9',
          previousVersionId: null,
          pointerCleared: false,
          actorUserId,
        },
      },
    });

    expect(result.salePrice?.toString()).toBe('29.9');
  });

  it.each([
    { label: 'the same value', salePrice: '19.90' },
    { label: 'null', salePrice: null },
  ])(
    'should treat $label as an explicit manual price decision',
    async ({ salePrice }) => {
      const previousVersionId = 'f11e2b0c-a8d5-4f91-bb63-3e751754dfe4';
      transaction.product.findFirst.mockResolvedValue({
        ...existingProduct,
        adoptedPricingVersionId: previousVersionId,
      });
      transaction.product.update.mockResolvedValue({
        ...existingProduct,
        salePrice: salePrice === null ? null : new Prisma.Decimal(salePrice),
      });

      await service.update(
        organizationId,
        actorUserId,
        OrganizationRole.ADMIN,
        productId,
        { salePrice },
      );

      expect(transaction.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            salePrice,
            adoptedPricingVersionId: null,
          }),
        }),
      );
      expect(transaction.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'product_price.manually_changed',
          metadata: {
            productId,
            previousPrice: '19.9',
            newPrice: salePrice === null ? null : '19.9',
            previousVersionId,
            pointerCleared: true,
            actorUserId,
          },
        }),
      });
    },
  );

  it('should preserve the price and adopted version when salePrice is omitted', async () => {
    transaction.product.update.mockResolvedValue(existingProduct);

    await service.update(
      organizationId,
      actorUserId,
      OrganizationRole.OPERATIONS,
      productId,
      { name: 'Papel A4' },
    );

    const data = transaction.product.update.mock.calls[0]?.[0].data;
    expect(data).not.toHaveProperty('salePrice');
    expect(data).not.toHaveProperty('adoptedPricingVersionId');
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'product.updated' }),
    });
  });

  it.each([
    OrganizationRole.OPERATIONS,
    OrganizationRole.FINANCE,
    OrganizationRole.VIEWER,
  ])(
    'should reject manual price changes for %s before a transaction',
    async (role) => {
      await expect(
        service.update(organizationId, actorUserId, role, productId, {
          salePrice: '29.90',
        }),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: PricingErrorCode.PRICING_FORBIDDEN },
      });

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    },
  );

  it('should omit directCost from the product detail select for VIEWER', async () => {
    await service.findOne(organizationId, OrganizationRole.VIEWER, productId);

    const select = prismaMock.product.findFirst.mock.calls[0]?.[0].select;
    expect(select).not.toHaveProperty('directCost');
  });

  it.each([
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.OPERATIONS,
    OrganizationRole.FINANCE,
  ])('should select directCost in product detail for %s', async (role) => {
    await service.findOne(organizationId, role, productId);

    expect(prismaMock.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ directCost: true }),
      }),
    );
  });

  it('should omit directCost from the product list select for VIEWER', async () => {
    await service.findAll(organizationId, OrganizationRole.VIEWER, {});

    const select = prismaMock.product.findMany.mock.calls[0]?.[0].select;
    expect(select).not.toHaveProperty('directCost');
  });

  it.each([
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.OPERATIONS,
    OrganizationRole.FINANCE,
  ])('should select directCost in the product list for %s', async (role) => {
    await service.findAll(organizationId, role, {});

    expect(prismaMock.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ directCost: true }),
      }),
    );
  });

  it('should propagate manual-price audit failure from the transaction', async () => {
    transaction.product.update.mockResolvedValue({
      ...existingProduct,
      salePrice: new Prisma.Decimal('0.01'),
    });
    transaction.auditLog.create.mockRejectedValue(
      new Error('forced audit failure'),
    );

    await expect(
      service.update(
        organizationId,
        actorUserId,
        OrganizationRole.OWNER,
        productId,
        { salePrice: '0.01', name: 'Must roll back' },
      ),
    ).rejects.toThrow('forced audit failure');

    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'product_price.manually_changed',
        metadata: expect.objectContaining({ newPrice: '0.01' }),
      }),
    });
  });

  it('should reject changing a tracked product into a service', async () => {
    await expect(
      service.update(
        organizationId,
        actorUserId,
        OrganizationRole.OWNER,
        productId,
        {
          type: ProductType.SERVICE,
        },
      ),
    ).rejects.toThrow('Serviços não podem controlar estoque.');

    expect(transaction.product.update).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it.each([
    {
      field: 'unit',
      dto: { unit: 'KG' },
    },
    {
      field: 'type',
      dto: {
        type: ProductType.SERVICE,
        trackInventory: false,
      },
    },
    {
      field: 'trackInventory',
      dto: { trackInventory: false },
    },
  ])('should protect $field when stock history exists', async ({ dto }) => {
    transaction.stockMovement.findFirst.mockResolvedValue({
      id: 'ff7e2b0c-a8d5-4f91-bb63-3e751754dfe4',
    });

    await expect(
      service.update(
        organizationId,
        actorUserId,
        OrganizationRole.OWNER,
        productId,
        dto,
      ),
    ).rejects.toThrow(
      'Produtos com histórico de estoque não podem alterar unidade, tipo ou controle de estoque.',
    );

    expect(transaction.product.update).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });
});
