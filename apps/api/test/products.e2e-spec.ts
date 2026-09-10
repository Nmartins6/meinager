import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { OrganizationRole } from '../src/generated/prisma/enums.js';

describe('Products (e2e)', () => {
  let app: NestExpressApplication | undefined;
  let prisma: PrismaService;
  let sessionCookie: string;
  let userId: string | undefined;
  let organizationId: string | undefined;
  let otherOrganizationId: string | undefined;

  function httpServer() {
    if (!app) {
      throw new Error('Test application was not initialized');
    }

    return app.getHttpServer();
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    const response = await request(httpServer())
      .post('/api/auth/register')
      .send({
        name: 'Produtos E2E',
        email: `products.${randomUUID()}@example.com`,
        password: 'senha-e2e-segura',
        organizationName: 'Empresa Produtos E2E',
      })
      .expect(201);

    userId = response.body.user.id;
    organizationId = response.body.organization.id;

    const cookieHeader = response.headers['set-cookie'];
    const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;

    if (!cookie) {
      throw new Error('Session cookie was not returned');
    }

    sessionCookie = cookie.split(';', 1)[0]!;

    const otherOrganization = await prisma.organization.create({
      data: {
        name: 'Outra Empresa Produtos E2E',
        slug: `other-products-${randomUUID()}`,
      },
    });

    otherOrganizationId = otherOrganization.id;
  });

  it('POST should create and normalize a product with decimal precision', async () => {
    const response = await request(httpServer())
      .post('/api/products')
      .set('Cookie', sessionCookie)
      .send({
        name: '  Papel especial  ',
        sku: '  papel-01  ',
        barcode: '  0012345678901  ',
        unit: '  un  ',
        directCost: '0.123456',
        trackInventory: true,
        minimumStock: '10.5',
        salePrice: '29.9',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      type: 'PRODUCT',
      name: 'Papel especial',
      sku: 'PAPEL-01',
      barcode: '0012345678901',
      unit: 'UN',
      directCost: '0.123456',
      trackInventory: true,
      minimumStock: '10.5',
      isActive: true,
      salePrice: '29.9',
    });

    const product = await prisma.product.findUniqueOrThrow({
      where: {
        id: response.body.id,
      },
    });

    expect(product.organizationId).toBe(organizationId);
    expect(product.normalizedName).toBe('papel especial');
    expect(product.directCost?.toString()).toBe('0.123456');
    expect(product.salePrice?.toString()).toBe('29.9');

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        action: 'product.created',
        entityId: product.id,
      },
    });

    expect(auditLog.entityType).toBe('product');
  });

  it('GET should return a service from the authenticated organization', async () => {
    const creation = await request(httpServer())
      .post('/api/products')
      .set('Cookie', sessionCookie)
      .send({
        type: 'SERVICE',
        name: 'Consultoria',
        unit: 'HORA',
      })
      .expect(201);

    const response = await request(httpServer())
      .get(`/api/products/${creation.body.id}`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      id: creation.body.id,
      type: 'SERVICE',
      name: 'Consultoria',
      directCost: null,
      trackInventory: false,
      minimumStock: null,
      salePrice: null,
    });
  });

  it('GET should isolate products in listing and individual lookup', async () => {
    if (!otherOrganizationId) {
      throw new Error('Other organization was not created');
    }

    const externalProduct = await prisma.product.create({
      data: {
        organizationId: otherOrganizationId,
        name: 'Produto exclusivo externo',
        normalizedName: 'produto exclusivo externo',
        unit: 'UN',
      },
    });

    await request(httpServer())
      .get(`/api/products/${externalProduct.id}`)
      .set('Cookie', sessionCookie)
      .expect(404);

    const response = await request(httpServer())
      .get('/api/products')
      .query({
        search: 'Produto exclusivo externo',
        page: 1,
        pageSize: 10,
      })
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(response.body).toEqual({
      data: [],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 0,
      },
    });
  });

  it('POST should reject incompatible inventory configurations', async () => {
    const serviceResponse = await request(httpServer())
      .post('/api/products')
      .set('Cookie', sessionCookie)
      .send({
        type: 'SERVICE',
        name: 'Consultoria inválida',
        unit: 'HORA',
        trackInventory: true,
      })
      .expect(400);

    expect(serviceResponse.body.message).toBe(
      'Serviços não podem controlar estoque.',
    );

    const minimumResponse = await request(httpServer())
      .post('/api/products')
      .set('Cookie', sessionCookie)
      .send({
        name: 'Produto sem controle',
        unit: 'UN',
        trackInventory: false,
        minimumStock: '5',
      })
      .expect(400);

    expect(minimumResponse.body.message).toBe(
      'O estoque mínimo exige que o controle de estoque esteja habilitado.',
    );
  });

  it('should reject unauthenticated requests', async () => {
    await request(httpServer()).get('/api/products').expect(401);

    await request(httpServer())
      .post('/api/products')
      .send({
        name: 'Produto não autorizado',
        unit: 'UN',
      })
      .expect(401);
  });

  it('PATCH should update, deactivate and clear inventory settings', async () => {
    const creation = await request(httpServer())
      .post('/api/products')
      .set('Cookie', sessionCookie)
      .send({
        name: 'Produto para atualização',
        unit: 'UN',
        directCost: '12.345678',
        trackInventory: true,
        minimumStock: '5',
        salePrice: '24.90',
      })
      .expect(201);

    const productId = creation.body.id;

    const response = await request(httpServer())
      .patch(`/api/products/${productId}`)
      .set('Cookie', sessionCookie)
      .send({
        name: '  Produto atualizado  ',
        directCost: null,
        trackInventory: false,
        isActive: false,
        salePrice: null,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: productId,
      name: 'Produto atualizado',
      unit: 'UN',
      directCost: null,
      trackInventory: false,
      minimumStock: null,
      isActive: false,
      salePrice: null,
    });

    const persisted = await prisma.product.findUniqueOrThrow({
      where: {
        id: productId,
      },
    });

    expect(persisted.normalizedName).toBe('produto atualizado');
    expect(persisted.directCost).toBeNull();
    expect(persisted.minimumStock).toBeNull();
    expect(persisted.isActive).toBe(false);
    expect(persisted.salePrice).toBeNull();

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        action: 'product.updated',
        entityId: productId,
      },
    });

    expect(auditLog.entityType).toBe('product');
  });

  it('PATCH should reject an empty payload', async () => {
    const creation = await request(httpServer())
      .post('/api/products')
      .set('Cookie', sessionCookie)
      .send({
        name: 'Produto sem alteração',
        unit: 'UN',
      })
      .expect(201);

    const response = await request(httpServer())
      .patch(`/api/products/${creation.body.id}`)
      .set('Cookie', sessionCookie)
      .send({})
      .expect(400);

    expect(response.body.message).toBe(
      'Informe ao menos um campo para atualizar.',
    );

    const auditCount = await prisma.auditLog.count({
      where: {
        organizationId,
        action: 'product.updated',
        entityId: creation.body.id,
      },
    });

    expect(auditCount).toBe(0);
  });

  it('PATCH should not update another organization product', async () => {
    if (!otherOrganizationId) {
      throw new Error('Other organization was not created');
    }

    const externalProduct = await prisma.product.create({
      data: {
        organizationId: otherOrganizationId,
        name: 'Produto externo protegido',
        normalizedName: 'produto externo protegido',
        unit: 'UN',
      },
    });

    await request(httpServer())
      .patch(`/api/products/${externalProduct.id}`)
      .set('Cookie', sessionCookie)
      .send({
        name: 'Alteração não autorizada',
        isActive: false,
      })
      .expect(404);

    const persisted = await prisma.product.findUniqueOrThrow({
      where: {
        id: externalProduct.id,
      },
    });

    expect(persisted.name).toBe('Produto externo protegido');
    expect(persisted.isActive).toBe(true);

    const auditCount = await prisma.auditLog.count({
      where: {
        action: 'product.updated',
        entityId: externalProduct.id,
      },
    });

    expect(auditCount).toBe(0);
  });

  it('should reject duplicated SKU and barcode on creation and update', async () => {
    const sku = `SKU-${randomUUID()}`;
    const barcode = `BAR-${randomUUID()}`;

    await request(httpServer())
      .post('/api/products')
      .set('Cookie', sessionCookie)
      .send({
        name: 'Produto com identificadores',
        unit: 'UN',
        sku,
        barcode,
      })
      .expect(201);

    const target = await request(httpServer())
      .post('/api/products')
      .set('Cookie', sessionCookie)
      .send({
        name: 'Produto alvo do conflito',
        unit: 'UN',
      })
      .expect(201);

    const conflictingIdentifiers = [
      { sku: `  ${sku.toLowerCase()}  ` },
      { barcode: `  ${barcode}  ` },
    ];

    for (const identifiers of conflictingIdentifiers) {
      const creationResponse = await request(httpServer())
        .post('/api/products')
        .set('Cookie', sessionCookie)
        .send({
          name: 'Produto duplicado',
          unit: 'UN',
          ...identifiers,
        })
        .expect(409);

      expect(creationResponse.body.message).toBe(
        'Já existe um produto com este SKU ou código de barras.',
      );

      const updateResponse = await request(httpServer())
        .patch(`/api/products/${target.body.id}`)
        .set('Cookie', sessionCookie)
        .send(identifiers)
        .expect(409);

      expect(updateResponse.body.message).toBe(
        'Já existe um produto com este SKU ou código de barras.',
      );
    }

    const persisted = await prisma.product.findUniqueOrThrow({
      where: {
        id: target.body.id,
      },
    });

    expect(persisted.sku).toBeNull();
    expect(persisted.barcode).toBeNull();

    const auditCount = await prisma.auditLog.count({
      where: {
        organizationId,
        action: 'product.updated',
        entityId: target.body.id,
      },
    });

    expect(auditCount).toBe(0);
  });

  it('should enforce product permissions for every organization role', async () => {
    if (!organizationId || !userId) {
      throw new Error('Test membership was not initialized');
    }

    const membershipWhere = {
      organizationId_userId: {
        organizationId,
        userId,
      },
    };

    try {
      for (const role of [
        OrganizationRole.OWNER,
        OrganizationRole.ADMIN,
        OrganizationRole.OPERATIONS,
      ]) {
        await prisma.organizationMember.update({
          where: membershipWhere,
          data: { role },
        });

        const creation = await request(httpServer())
          .post('/api/products')
          .set('Cookie', sessionCookie)
          .send({
            name: `Produto criado por ${role}`,
            unit: 'UN',
          })
          .expect(201);

        const update = await request(httpServer())
          .patch(`/api/products/${creation.body.id}`)
          .set('Cookie', sessionCookie)
          .send({
            name: `Produto atualizado por ${role}`,
          })
          .expect(200);

        expect(update.body.name).toBe(`Produto atualizado por ${role}`);
      }

      await prisma.organizationMember.update({
        where: membershipWhere,
        data: { role: OrganizationRole.OWNER },
      });

      const target = await request(httpServer())
        .post('/api/products')
        .set('Cookie', sessionCookie)
        .send({
          name: 'Produto protegido por permissões',
          unit: 'UN',
        })
        .expect(201);

      for (const role of [OrganizationRole.FINANCE, OrganizationRole.VIEWER]) {
        await prisma.organizationMember.update({
          where: membershipWhere,
          data: { role },
        });

        await request(httpServer())
          .get('/api/products')
          .set('Cookie', sessionCookie)
          .expect(200);

        await request(httpServer())
          .get(`/api/products/${target.body.id}`)
          .set('Cookie', sessionCookie)
          .expect(200);

        await request(httpServer())
          .post('/api/products')
          .set('Cookie', sessionCookie)
          .send({
            name: `Criação proibida por ${role}`,
            unit: 'UN',
          })
          .expect(403);

        await request(httpServer())
          .patch(`/api/products/${target.body.id}`)
          .set('Cookie', sessionCookie)
          .send({
            name: `Alteração proibida por ${role}`,
          })
          .expect(403);
      }

      const persisted = await prisma.product.findUniqueOrThrow({
        where: { id: target.body.id },
      });

      expect(persisted.name).toBe('Produto protegido por permissões');

      const auditCount = await prisma.auditLog.count({
        where: {
          organizationId,
          action: 'product.updated',
          entityId: target.body.id,
        },
      });

      expect(auditCount).toBe(0);
    } finally {
      await prisma.organizationMember.update({
        where: membershipWhere,
        data: { role: OrganizationRole.OWNER },
      });
    }
  });

  it('should reject protected fields on creation and update', async () => {
    if (!otherOrganizationId) {
      throw new Error('Other organization was not created');
    }

    const creation = await request(httpServer())
      .post('/api/products')
      .set('Cookie', sessionCookie)
      .send({
        name: 'Produto com campos protegidos',
        unit: 'UN',
      })
      .expect(201);

    const protectedFields = [
      { organizationId: otherOrganizationId },
      { normalizedName: 'nome manipulado' },
      { id: randomUUID() },
    ];

    for (const fields of protectedFields) {
      await request(httpServer())
        .post('/api/products')
        .set('Cookie', sessionCookie)
        .send({
          name: 'Criação com campo protegido',
          unit: 'UN',
          ...fields,
        })
        .expect(400);

      await request(httpServer())
        .patch(`/api/products/${creation.body.id}`)
        .set('Cookie', sessionCookie)
        .send(fields)
        .expect(400);
    }

    const persisted = await prisma.product.findUniqueOrThrow({
      where: { id: creation.body.id },
    });

    expect(persisted.organizationId).toBe(organizationId);
    expect(persisted.normalizedName).toBe('produto com campos protegidos');
  });

  it('should reject invalid decimal values on creation and update', async () => {
    const creation = await request(httpServer())
      .post('/api/products')
      .set('Cookie', sessionCookie)
      .send({
        name: 'Produto para validação decimal',
        unit: 'UN',
        directCost: '1.25',
        trackInventory: true,
        minimumStock: '2',
        salePrice: '10.50',
      })
      .expect(201);

    const invalidValues = [
      '-1',
      1.25,
      '0.1234567',
      '1000000000000',
      '1,25',
      '1e3',
    ];

    for (const field of ['directCost', 'minimumStock']) {
      for (const value of invalidValues) {
        await request(httpServer())
          .post('/api/products')
          .set('Cookie', sessionCookie)
          .send({
            name: 'Produto com decimal inválido',
            unit: 'UN',
            trackInventory: true,
            [field]: value,
          })
          .expect(400);

        await request(httpServer())
          .patch(`/api/products/${creation.body.id}`)
          .set('Cookie', sessionCookie)
          .send({
            [field]: value,
          })
          .expect(400);
      }

      for (const value of [...invalidValues, '0.123']) {
        await request(httpServer())
          .post('/api/products')
          .set('Cookie', sessionCookie)
          .send({
            name: 'Produto com preço de venda inválido',
            unit: 'UN',
            salePrice: value,
          })
          .expect(400);

        await request(httpServer())
          .patch(`/api/products/${creation.body.id}`)
          .set('Cookie', sessionCookie)
          .send({
            salePrice: value,
          })
          .expect(400);
      }
    }

    const persisted = await prisma.product.findUniqueOrThrow({
      where: { id: creation.body.id },
    });

    expect(persisted.directCost?.toString()).toBe('1.25');
    expect(persisted.minimumStock?.toString()).toBe('2');
    expect(persisted.salePrice?.toString()).toBe('10.5');
  });

  afterAll(async () => {
    try {
      if (otherOrganizationId) {
        await prisma.organization.delete({
          where: {
            id: otherOrganizationId,
          },
        });
      }

      if (organizationId) {
        await prisma.$transaction([
          prisma.auditLog.deleteMany({
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
