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

    it('POST reverse should reverse an entry and preserve its original record', async () => {
    const productId = await createProduct();
    const original = await createMovement(
      productId,
      'IN',
      '1.000001',
    ).expect(201);

    const originalRecord = await prisma.stockMovement.findUniqueOrThrow({
      where: { id: original.body.id },
    });

    const response = await request(httpServer())
      .post(
        `/api/inventory/products/${productId}/movements/${original.body.id}/reverse`,
      )
      .set('Cookie', sessionCookie)
      .send({
        reason: '  Entrada registrada por engano  ',
        notes: 'Correção do estoque.',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      productId,
      type: 'OUT',
      origin: 'REVERSAL',
      quantity: '1.000001',
      reversalOfId: original.body.id,
      reason: 'Entrada registrada por engano',
      notes: 'Correção do estoque.',
    });

    const preservedRecord = await prisma.stockMovement.findUniqueOrThrow({
      where: { id: original.body.id },
    });

    expect(preservedRecord).toEqual(originalRecord);

    const balance = await request(httpServer())
      .get(`/api/inventory/products/${productId}/balance`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(balance.body).toMatchObject({
      totalIn: '1.000001',
      totalOut: '1.000001',
      balance: '0',
    });

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        action: 'stock_movement.reversed',
        entityId: original.body.id,
      },
    });

    expect(audit.entityType).toBe('stock_movement');
    expect(audit.metadata).toEqual({
      productId,
      reversalId: response.body.id,
      originalType: 'IN',
      reversalType: 'OUT',
      quantity: '1.000001',
      reason: 'Entrada registrada por engano',
    });
  });

  it('POST reverse should restore a withdrawal from an inactive product', async () => {
    const productId = await createProduct();

    await createMovement(productId, 'IN', '2').expect(201);

    const withdrawal = await createMovement(
      productId,
      'OUT',
      '0.500001',
    ).expect(201);

    await request(httpServer())
      .patch(`/api/products/${productId}`)
      .set('Cookie', sessionCookie)
      .send({ isActive: false })
      .expect(200);

    const response = await request(httpServer())
      .post(
        `/api/inventory/products/${productId}/movements/${withdrawal.body.id}/reverse`,
      )
      .set('Cookie', sessionCookie)
      .send({ reason: 'Saída registrada por engano' })
      .expect(201);

    expect(response.body).toMatchObject({
      productId,
      type: 'IN',
      origin: 'REVERSAL',
      quantity: '0.500001',
      reversalOfId: withdrawal.body.id,
    });

    const balance = await request(httpServer())
      .get(`/api/inventory/products/${productId}/balance`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(balance.body).toMatchObject({
      totalIn: '2.500001',
      totalOut: '0.500001',
      balance: '2',
    });

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });

    expect(product.isActive).toBe(false);
  });

  it('POST reverse should reject repeated reversals and reversing a reversal', async () => {
    const productId = await createProduct();
    const original = await createMovement(productId, 'IN', '1').expect(201);

    const originalUrl =
      `/api/inventory/products/${productId}/movements/${original.body.id}/reverse`;

    const reversal = await request(httpServer())
      .post(originalUrl)
      .set('Cookie', sessionCookie)
      .send({ reason: 'Correção de entrada' })
      .expect(201);

    const repeated = await request(httpServer())
      .post(originalUrl)
      .set('Cookie', sessionCookie)
      .send({ reason: 'Tentativa de repetir o estorno' })
      .expect(409);

    expect(repeated.body.message).toBe(
      'Esta movimentação já foi estornada.',
    );

    const chained = await request(httpServer())
      .post(
        `/api/inventory/products/${productId}/movements/${reversal.body.id}/reverse`,
      )
      .set('Cookie', sessionCookie)
      .send({ reason: 'Tentativa de estornar um estorno' })
      .expect(400);

    expect(chained.body.message).toBe(
      'Não é possível estornar uma movimentação de estorno.',
    );

    expect(
      await prisma.stockMovement.count({
        where: { organizationId, productId },
      }),
    ).toBe(2);

    expect(
      await prisma.auditLog.count({
        where: {
          organizationId,
          action: 'stock_movement.reversed',
          entityId: original.body.id,
        },
      }),
    ).toBe(1);
  });

  it('POST reverse should reject insufficient stock without persisting changes', async () => {
    const productId = await createProduct();
    const original = await createMovement(productId, 'IN', '2').expect(201);

    await createMovement(productId, 'OUT', '0.000001').expect(201);

    const response = await request(httpServer())
      .post(
        `/api/inventory/products/${productId}/movements/${original.body.id}/reverse`,
      )
      .set('Cookie', sessionCookie)
      .send({ reason: 'Correção da entrada original' })
      .expect(409);

    expect(response.body.message).toBe(
      'Saldo de estoque insuficiente para estornar esta entrada.',
    );

    expect(
      await prisma.stockMovement.count({
        where: { organizationId, productId },
      }),
    ).toBe(2);

    expect(
      await prisma.auditLog.count({
        where: {
          organizationId,
          action: 'stock_movement.reversed',
          entityId: original.body.id,
        },
      }),
    ).toBe(0);

    const balance = await request(httpServer())
      .get(`/api/inventory/products/${productId}/balance`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(balance.body.balance).toBe('1.999999');
  });

  it('POST reverse should serialize concurrent reversals of the same movement', async () => {
    const productId = await createProduct();

    await createMovement(productId, 'IN', '1').expect(201);

    const withdrawal = await createMovement(
      productId,
      'OUT',
      '1',
    ).expect(201);

    const url =
      `/api/inventory/products/${productId}/movements/${withdrawal.body.id}/reverse`;

    const responses = await Promise.all([
      request(httpServer())
        .post(url)
        .set('Cookie', sessionCookie)
        .send({ reason: 'Primeira solicitação de estorno' }),
      request(httpServer())
        .post(url)
        .set('Cookie', sessionCookie)
        .send({ reason: 'Segunda solicitação de estorno' }),
    ]);

    expect(
      responses.map((response) => response.status).sort(),
    ).toEqual([201, 409]);

    expect(
      await prisma.stockMovement.count({
        where: {
          organizationId,
          productId,
          reversalOfId: withdrawal.body.id,
        },
      }),
    ).toBe(1);

    expect(
      await prisma.auditLog.count({
        where: {
          organizationId,
          action: 'stock_movement.reversed',
          entityId: withdrawal.body.id,
        },
      }),
    ).toBe(1);

    const balance = await request(httpServer())
      .get(`/api/inventory/products/${productId}/balance`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(balance.body.balance).toBe('1');
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

    it('POST reverse should enforce permissions for every organization role', async () => {
    if (!organizationId || !userId) {
      throw new Error('Authenticated organization was not initialized');
    }

    const productId = await createProduct();
    const cases = [
      { role: OrganizationRole.OWNER, expectedStatus: 201 },
      { role: OrganizationRole.ADMIN, expectedStatus: 201 },
      { role: OrganizationRole.OPERATIONS, expectedStatus: 201 },
      { role: OrganizationRole.FINANCE, expectedStatus: 403 },
      { role: OrganizationRole.VIEWER, expectedStatus: 403 },
    ];

    const movementIds: string[] = [];

    for (let index = 0; index < cases.length; index += 1) {
      const movement = await createMovement(
        productId,
        'IN',
        '1',
      ).expect(201);

      movementIds.push(movement.body.id);
    }

    const membershipWhere = {
      organizationId_userId: {
        organizationId,
        userId,
      },
    };

    try {
      for (const [index, permissionCase] of cases.entries()) {
        await prisma.organizationMember.update({
          where: membershipWhere,
          data: { role: permissionCase.role },
        });

        await request(httpServer())
          .post(
            `/api/inventory/products/${productId}/movements/${movementIds[index]}/reverse`,
          )
          .set('Cookie', sessionCookie)
          .send({ reason: 'Correção de movimentação' })
          .expect(permissionCase.expectedStatus);
      }

      expect(
        await prisma.stockMovement.count({
          where: {
            organizationId,
            productId,
            origin: 'REVERSAL',
          },
        }),
      ).toBe(3);

      const balance = await request(httpServer())
        .get(`/api/inventory/products/${productId}/balance`)
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(balance.body.balance).toBe('2');
    } finally {
      await prisma.organizationMember.update({
        where: membershipWhere,
        data: { role: OrganizationRole.OWNER },
      });
    }
  });

  it('POST reverse should isolate movements by organization and product', async () => {
    const productId = await createProduct();
    const anotherProductId = await createProduct();

    const ownMovement = await createMovement(
      productId,
      'IN',
      '1',
    ).expect(201);

    const otherOrganization = await prisma.organization.create({
      data: {
        name: 'Empresa externa de estoque',
        slug: `estoque-externo-${randomUUID()}`,
      },
    });

    try {
      const externalProduct = await prisma.product.create({
        data: {
          organizationId: otherOrganization.id,
          name: 'Produto externo',
          normalizedName: 'produto externo',
          unit: 'UN',
          type: 'PRODUCT',
          trackInventory: true,
        },
      });

      const externalMovement = await prisma.stockMovement.create({
        data: {
          organizationId: otherOrganization.id,
          productId: externalProduct.id,
          type: 'IN',
          origin: 'MANUAL',
          quantity: '1',
          reason: 'Entrada externa de teste',
          occurredAt: new Date(),
        },
      });

      const attempts = [
        {
          productId: externalProduct.id,
          movementId: externalMovement.id,
        },
        {
          productId,
          movementId: externalMovement.id,
        },
        {
          productId: anotherProductId,
          movementId: ownMovement.body.id,
        },
        {
          productId,
          movementId: randomUUID(),
        },
      ];

      for (const attempt of attempts) {
        await request(httpServer())
          .post(
            `/api/inventory/products/${attempt.productId}/movements/${attempt.movementId}/reverse`,
          )
          .set('Cookie', sessionCookie)
          .send({ reason: 'Tentativa de estorno indevido' })
          .expect(404);
      }

      expect(
        await prisma.stockMovement.count({
          where: {
            reversalOfId: {
              in: [ownMovement.body.id, externalMovement.id],
            },
          },
        }),
      ).toBe(0);

      expect(
        await prisma.auditLog.count({
          where: {
            action: 'stock_movement.reversed',
            entityId: {
              in: [ownMovement.body.id, externalMovement.id],
            },
          },
        }),
      ).toBe(0);
    } finally {
      await prisma.$transaction([
        prisma.auditLog.deleteMany({
          where: { organizationId: otherOrganization.id },
        }),
        prisma.stockMovement.deleteMany({
          where: { organizationId: otherOrganization.id },
        }),
        prisma.organization.delete({
          where: { id: otherOrganization.id },
        }),
      ]);
    }
  });

  it('POST reverse should require authentication and validate its payload', async () => {
    const productId = await createProduct();
    const original = await createMovement(
      productId,
      'IN',
      '1',
    ).expect(201);

    const url =
      `/api/inventory/products/${productId}/movements/${original.body.id}/reverse`;

    await request(httpServer())
      .post(url)
      .send({ reason: 'Correção sem autenticação' })
      .expect(401);

    const invalidPayloads = [
      {},
      { reason: null },
      { reason: 123 },
      { reason: '' },
      { reason: '   ' },
      { reason: 'ab' },
      { reason: 'a'.repeat(256) },
      { reason: 'Correção válida', notes: 'a'.repeat(2001) },
      { reason: 'Correção válida', quantity: '0.5' },
      { reason: 'Correção válida', type: 'IN' },
      { reason: 'Correção válida', origin: 'MANUAL' },
      { reason: 'Correção válida', organizationId: randomUUID() },
      { reason: 'Correção válida', productId: randomUUID() },
      { reason: 'Correção válida', reversalOfId: randomUUID() },
      {
        reason: 'Correção válida',
        occurredAt: '2026-01-01T12:00:00.000Z',
      },
    ];

    for (const payload of invalidPayloads) {
      await request(httpServer())
        .post(url)
        .set('Cookie', sessionCookie)
        .send(payload)
        .expect(400);
    }

    expect(
      await prisma.stockMovement.count({
        where: { organizationId, productId },
      }),
    ).toBe(1);

    expect(
      await prisma.auditLog.count({
        where: {
          organizationId,
          action: 'stock_movement.reversed',
          entityId: original.body.id,
        },
      }),
    ).toBe(0);
  });
});