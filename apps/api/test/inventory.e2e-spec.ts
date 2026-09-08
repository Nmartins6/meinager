import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { OrganizationRole } from '../src/generated/prisma/enums.js';

describe('Inventory (e2e)', () => {
  let app: NestExpressApplication | undefined;
  let prisma: PrismaService;
  let sessionCookie: string;
  let userId: string | undefined;
  let organizationId: string | undefined;

  function httpServer() {
    if (!app) {
      throw new Error('Test application was not initialized');
    }

    return app.getHttpServer();
  }

  async function createProduct(): Promise<string> {
    const response = await request(httpServer())
      .post('/api/products')
      .set('Cookie', sessionCookie)
      .send({
        name: `Produto estoque ${randomUUID()}`,
        unit: 'UN',
        trackInventory: true,
        minimumStock: '1',
      })
      .expect(201);

    return response.body.id;
  }

  function createMovement(
    productId: string,
    type: 'IN' | 'OUT',
    quantity: string,
  ) {
    return request(httpServer())
      .post(`/api/inventory/products/${productId}/movements`)
      .set('Cookie', sessionCookie)
      .send({
        type,
        quantity,
        reason: 'Movimentação de teste',
      });
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    const registration = await request(httpServer())
      .post('/api/auth/register')
      .send({
        name: 'Estoque E2E',
        email: `inventory.${randomUUID()}@example.com`,
        password: 'senha-e2e-segura',
        organizationName: 'Empresa Estoque E2E',
      })
      .expect(201);

    userId = registration.body.user.id;
    organizationId = registration.body.organization.id;

    const cookieHeader = registration.headers['set-cookie'];
    const cookie = Array.isArray(cookieHeader)
      ? cookieHeader[0]
      : cookieHeader;

    if (!cookie) {
      throw new Error('Session cookie was not returned');
    }

    sessionCookie = cookie.split(';', 1)[0]!;
  });

  it('GET should return zero balance for a product without movements', async () => {
    const productId = await createProduct();

    const response = await request(httpServer())
      .get(`/api/inventory/products/${productId}/balance`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(response.body).toEqual({
      productId,
      unit: 'UN',
      trackInventory: true,
      minimumStock: '1',
      totalIn: '0',
      totalOut: '0',
      balance: '0',
      isBelowMinimum: true,
    });
  });

  it('should preserve decimal precision and filter history independently of balance', async () => {
    const productId = await createProduct();

    const entry = await createMovement(
      productId,
      'IN',
      '1.000001',
    ).expect(201);

    expect(entry.body).toMatchObject({
      productId,
      type: 'IN',
      origin: 'MANUAL',
      quantity: '1.000001',
      reversalOfId: null,
    });

    const exit = await createMovement(
      productId,
      'OUT',
      '0.000002',
    ).expect(201);

    const history = await request(httpServer())
      .get(`/api/inventory/products/${productId}/movements`)
      .set('Cookie', sessionCookie)
      .query({
        type: 'OUT',
        origin: 'MANUAL',
        page: 1,
        pageSize: 1,
      })
      .expect(200);

    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0]).toMatchObject({
      id: exit.body.id,
      type: 'OUT',
      quantity: '0.000002',
    });

    expect(history.body.pagination).toEqual({
      page: 1,
      pageSize: 1,
      total: 1,
      totalPages: 1,
    });

    const balance = await request(httpServer())
      .get(`/api/inventory/products/${productId}/balance`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(balance.body).toMatchObject({
      totalIn: '1.000001',
      totalOut: '0.000002',
      balance: '0.999999',
      isBelowMinimum: true,
    });

    const persisted = await prisma.stockMovement.findUniqueOrThrow({
      where: {
        id: entry.body.id,
      },
    });

    expect(persisted.organizationId).toBe(organizationId);
    expect(persisted.quantity.toString()).toBe('1.000001');

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        action: 'stock_movement.created',
        entityId: entry.body.id,
      },
    });

    expect(audit.entityType).toBe('stock_movement');
    expect(audit.metadata).toMatchObject({
      productId,
      type: 'IN',
      quantity: '1.000001',
    });
  });

  it('POST should reject an excessive withdrawal without persisting changes', async () => {
    const productId = await createProduct();

    await createMovement(productId, 'IN', '2').expect(201);

    const response = await createMovement(
      productId,
      'OUT',
      '2.000001',
    ).expect(409);

    expect(response.body.message).toBe(
      'Saldo de estoque insuficiente para esta saída.',
    );

    const movementCount = await prisma.stockMovement.count({
      where: {
        organizationId,
        productId,
      },
    });

    expect(movementCount).toBe(1);

    const auditCount = await prisma.auditLog.count({
      where: {
        organizationId,
        action: 'stock_movement.created',
        metadata: {
          path: ['productId'],
          equals: productId,
        },
      },
    });

    expect(auditCount).toBe(1);

    const balance = await request(httpServer())
      .get(`/api/inventory/products/${productId}/balance`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(balance.body).toMatchObject({
      totalIn: '2',
      totalOut: '0',
      balance: '2',
      isBelowMinimum: false,
    });
  });

  it('POST should serialize concurrent withdrawals and prevent negative stock', async () => {
    const productId = await createProduct();

    await createMovement(productId, 'IN', '1').expect(201);

    const responses = await Promise.all([
      createMovement(productId, 'OUT', '0.7'),
      createMovement(productId, 'OUT', '0.7'),
    ]);

    expect(
      responses.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([201, 409]);

    const balance = await request(httpServer())
      .get(`/api/inventory/products/${productId}/balance`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(balance.body).toMatchObject({
      totalIn: '1',
      totalOut: '0.7',
      balance: '0.3',
    });

    const withdrawalCount = await prisma.stockMovement.count({
      where: {
        organizationId,
        productId,
        type: 'OUT',
      },
    });

    expect(withdrawalCount).toBe(1);
  });

    it('should enforce movement permissions for every organization role', async () => {
    if (!organizationId || !userId) {
      throw new Error('Test membership was not initialized');
    }

    const productId = await createProduct();

    const membershipWhere = {
      organizationId_userId: {
        organizationId,
        userId,
      },
    };

    const roles = [
      { role: OrganizationRole.OWNER, canWrite: true },
      { role: OrganizationRole.ADMIN, canWrite: true },
      { role: OrganizationRole.OPERATIONS, canWrite: true },
      { role: OrganizationRole.FINANCE, canWrite: false },
      { role: OrganizationRole.VIEWER, canWrite: false },
    ];

    try {
      for (const { role, canWrite } of roles) {
        await prisma.organizationMember.update({
          where: membershipWhere,
          data: { role },
        });

        await request(httpServer())
          .get(`/api/inventory/products/${productId}/balance`)
          .set('Cookie', sessionCookie)
          .expect(200);

        await request(httpServer())
          .get(`/api/inventory/products/${productId}/movements`)
          .set('Cookie', sessionCookie)
          .expect(200);

        await createMovement(productId, 'IN', '1')
          .expect(canWrite ? 201 : 403);
      }

      const movementCount = await prisma.stockMovement.count({
        where: {
          organizationId,
          productId,
        },
      });

      expect(movementCount).toBe(3);

      const balance = await request(httpServer())
        .get(`/api/inventory/products/${productId}/balance`)
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(balance.body.balance).toBe('3');
    } finally {
      await prisma.organizationMember.update({
        where: membershipWhere,
        data: { role: OrganizationRole.OWNER },
      });
    }
  });

  it('should not read or move stock from another organization', async () => {
    const otherOrganization = await prisma.organization.create({
      data: {
        name: 'Outra Empresa Estoque E2E',
        slug: `other-inventory-${randomUUID()}`,
      },
    });

    try {
      const externalProduct = await prisma.product.create({
        data: {
          organizationId: otherOrganization.id,
          name: 'Produto externo protegido',
          normalizedName: 'produto externo protegido',
          unit: 'UN',
          trackInventory: true,
        },
      });

      await request(httpServer())
        .get(`/api/inventory/products/${externalProduct.id}/balance`)
        .set('Cookie', sessionCookie)
        .expect(404);

      await request(httpServer())
        .get(`/api/inventory/products/${externalProduct.id}/movements`)
        .set('Cookie', sessionCookie)
        .expect(404);

      await createMovement(externalProduct.id, 'IN', '10')
        .expect(404);

      const movementCount = await prisma.stockMovement.count({
        where: {
          productId: externalProduct.id,
        },
      });

      expect(movementCount).toBe(0);
    } finally {
      await prisma.$transaction([
        prisma.auditLog.deleteMany({
          where: {
            organizationId: otherOrganization.id,
          },
        }),
        prisma.stockMovement.deleteMany({
          where: {
            organizationId: otherOrganization.id,
          },
        }),
        prisma.organization.delete({
          where: {
            id: otherOrganization.id,
          },
        }),
      ]);
    }
  });

  it('should protect inventory definitions even when the balance returns to zero', async () => {
    const productId = await createProduct();

    await createMovement(productId, 'IN', '0.5').expect(201);
    await createMovement(productId, 'OUT', '0.5').expect(201);

    const balance = await request(httpServer())
      .get(`/api/inventory/products/${productId}/balance`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(balance.body.balance).toBe('0');

    const forbiddenChanges = [
      { unit: 'KG' },
      { type: 'SERVICE', trackInventory: false },
      { trackInventory: false },
    ];

    for (const changes of forbiddenChanges) {
      const response = await request(httpServer())
        .patch(`/api/products/${productId}`)
        .set('Cookie', sessionCookie)
        .send(changes)
        .expect(400);

      expect(response.body.message).toBe(
        'Produtos com histórico de estoque não podem alterar unidade, tipo ou controle de estoque.',
      );
    }

    const persisted = await prisma.product.findUniqueOrThrow({
      where: {
        id: productId,
      },
    });

    expect(persisted.type).toBe('PRODUCT');
    expect(persisted.unit).toBe('UN');
    expect(persisted.trackInventory).toBe(true);

    const auditCount = await prisma.auditLog.count({
      where: {
        organizationId,
        action: 'product.updated',
        entityId: productId,
      },
    });

    expect(auditCount).toBe(0);

    const allowedUpdate = await request(httpServer())
      .patch(`/api/products/${productId}`)
      .set('Cookie', sessionCookie)
      .send({
        name: 'Produto renomeado com histórico',
        minimumStock: '3',
      })
      .expect(200);

    expect(allowedUpdate.body).toMatchObject({
      name: 'Produto renomeado com histórico',
      minimumStock: '3',
      trackInventory: true,
    });
  });

    it('should reject unauthenticated inventory requests', async () => {
    const productId = await createProduct();

    await request(httpServer())
      .get(`/api/inventory/products/${productId}/balance`)
      .expect(401);

    await request(httpServer())
      .get(`/api/inventory/products/${productId}/movements`)
      .expect(401);

    await request(httpServer())
      .post(`/api/inventory/products/${productId}/movements`)
      .send({
        type: 'IN',
        quantity: '1',
        reason: 'Entrada sem autenticação',
      })
      .expect(401);

    expect(
      await prisma.stockMovement.count({
        where: { productId },
      }),
    ).toBe(0);
  });

  it('POST should reject invalid quantities and protected fields', async () => {
    const productId = await createProduct();

    const invalidPayloads = [
      { quantity: '0' },
      { quantity: '0.000000' },
      { quantity: '-1' },
      { quantity: 1.5 },
      { quantity: null },
      { quantity: '0.1234567' },
      { quantity: '1000000000000' },
      { quantity: '1,5' },
      { quantity: 'NaN' },
      { quantity: 'Infinity' },
      { quantity: '1e3' },
      { reason: '  ' },
      { reason: 'ab' },
      { type: 'INVALID' },
      { organizationId: randomUUID() },
      { productId: randomUUID() },
      { origin: 'REVERSAL' },
      { reversalOfId: randomUUID() },
      { occurredAt: '2026-01-01T12:00:00.000Z' },
    ];

    for (const invalidPayload of invalidPayloads) {
      await request(httpServer())
        .post(`/api/inventory/products/${productId}/movements`)
        .set('Cookie', sessionCookie)
        .send({
          type: 'IN',
          quantity: '1',
          reason: 'Entrada de teste',
          ...invalidPayload,
        })
        .expect(400);
    }

    expect(
      await prisma.stockMovement.count({
        where: { productId },
      }),
    ).toBe(0);

    expect(
      await prisma.auditLog.count({
        where: {
          organizationId,
          action: 'stock_movement.created',
          metadata: {
            path: ['productId'],
            equals: productId,
          },
        },
      }),
    ).toBe(0);
  });

  it('should preserve inactive product history and reject new movements', async () => {
    const productId = await createProduct();

    await createMovement(productId, 'IN', '2').expect(201);

    await request(httpServer())
      .patch(`/api/products/${productId}`)
      .set('Cookie', sessionCookie)
      .send({ isActive: false })
      .expect(200);

    for (const type of ['IN', 'OUT'] as const) {
      const response = await createMovement(productId, type, '1')
        .expect(400);

      expect(response.body.message).toBe(
        'Produtos inativos não podem receber movimentações.',
      );
    }

    const balance = await request(httpServer())
      .get(`/api/inventory/products/${productId}/balance`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(balance.body.balance).toBe('2');

    const history = await request(httpServer())
      .get(`/api/inventory/products/${productId}/movements`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(history.body.pagination.total).toBe(1);
    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0].quantity).toBe('2');
  });

  it('POST should reject services and products without inventory tracking', async () => {
    for (const type of ['PRODUCT', 'SERVICE'] as const) {
      const creation = await request(httpServer())
        .post('/api/products')
        .set('Cookie', sessionCookie)
        .send({
          type,
          name: `Item sem estoque ${randomUUID()}`,
          unit: 'UN',
          trackInventory: false,
        })
        .expect(201);

      const response = await createMovement(
        creation.body.id,
        'IN',
        '1',
      ).expect(400);

      expect(response.body.message).toBe(
        'O produto deve ter o controle de estoque habilitado.',
      );

      expect(
        await prisma.stockMovement.count({
          where: {
            productId: creation.body.id,
          },
        }),
      ).toBe(0);
    }
  });

  afterAll(async () => {
    try {
      if (organizationId) {
        await prisma.$transaction([
          prisma.auditLog.deleteMany({
            where: {
              organizationId,
            },
          }),
          prisma.stockMovement.deleteMany({
            where: {
              organizationId,
            },
          }),
          prisma.organization.delete({
            where: {
              id: organizationId,
            },
          }),
        ]);
      }

      if (userId) {
        await prisma.user.delete({
          where: {
            id: userId,
          },
        });
      }
    } finally {
      await app?.close();
    }
  });
});