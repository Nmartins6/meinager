import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { ProductType } from '../generated/prisma/enums.js';
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
  };

  const transaction = {
    product: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };

  const prismaMock = {
    $transaction: vi.fn(),
  };

  let service: ProductsService;

  beforeEach(async () => {
    vi.resetAllMocks();

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    transaction.product.findFirst.mockResolvedValue(existingProduct);
    transaction.auditLog.create.mockResolvedValue({});

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
      service.update(organizationId, actorUserId, productId, {}),
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

  it('should reject changing a tracked product into a service', async () => {
    await expect(
      service.update(organizationId, actorUserId, productId, {
        type: ProductType.SERVICE,
      }),
    ).rejects.toThrow('Serviços não podem controlar estoque.');

    expect(transaction.product.update).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });
});
