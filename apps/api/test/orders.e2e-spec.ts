import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/database/prisma.service.js';
import {
  OrganizationRole,
  QuoteStatus,
} from '../src/generated/prisma/enums.js';

describe('Orders (e2e)', () => {
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

  function currentOrganizationId() {
    if (!organizationId) {
      throw new Error('Organization was not initialized');
    }

    return organizationId;
  }

  async function createClient(isActive = true) {
    const name = `Cliente pedido ${randomUUID()}`;

    return prisma.client.create({
      data: {
        organizationId: currentOrganizationId(),
        name,
        isActive,
      },
    });
  }

  async function createProduct(isActive = true) {
    const name = `Produto pedido ${randomUUID()}`;

    return prisma.product.create({
      data: {
        organizationId: currentOrganizationId(),
        name,
        normalizedName: name.toLowerCase(),
        unit: 'UN',
        isActive,
      },
    });
  }

  async function createApprovedQuote() {
    const client = await createClient();

    const creation = await request(httpServer())
      .post('/api/quotes')
      .set('Cookie', sessionCookie)
      .send({
        clientId: client.id,
        discount: '2',
        notes: 'Orçamento convertido em pedido.',
        items: [
          {
            description: 'Item do pedido',
            unit: 'UN',
            quantity: '2',
            unitPrice: '10',
          },
        ],
      })
      .expect(201);

    await request(httpServer())
      .post(`/api/quotes/${creation.body.id}/send`)
      .set('Cookie', sessionCookie)
      .expect(201);

    const approval = await request(httpServer())
      .post(`/api/quotes/${creation.body.id}/approve`)
      .set('Cookie', sessionCookie)
      .expect(201);

    return {
      client,
      quote: approval.body,
    };
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
        name: 'Pedidos E2E',
        email: `orders.${randomUUID()}@example.com`,
        password: 'senha-e2e-segura',
        organizationName: 'Empresa Pedidos E2E',
      })
      .expect(201);

    userId = registration.body.user.id;
    organizationId = registration.body.organization.id;

    const cookieHeader = registration.headers['set-cookie'];
    const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;

    if (!cookie) {
      throw new Error('Session cookie was not returned');
    }

    sessionCookie = cookie.split(';', 1)[0]!;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('POST should convert an approved quote, preserve snapshots and create an audit record', async () => {
    const client = await createClient();
    const product = await createProduct();

    const creation = await request(httpServer())
      .post('/api/quotes')
      .set('Cookie', sessionCookie)
      .send({
        clientId: client.id,
        discount: '0.33',
        notes: '  Pedido para produção  ',
        items: [
          {
            productId: product.id,
            description: '  Caneca personalizada  ',
            unit: ' un ',
            quantity: '1.333333',
            unitPrice: '10',
          },
          {
            description: 'Arte exclusiva',
            unit: 'UN',
            quantity: '2',
            unitPrice: '5',
            notes: 'Inclusa no pedido',
          },
        ],
      })
      .expect(201);

    await request(httpServer())
      .post(`/api/quotes/${creation.body.id}/send`)
      .set('Cookie', sessionCookie)
      .expect(201);

    const approval = await request(httpServer())
      .post(`/api/quotes/${creation.body.id}/approve`)
      .set('Cookie', sessionCookie)
      .expect(201);

    const response = await request(httpServer())
      .post('/api/orders')
      .set('Cookie', sessionCookie)
      .send({
        quoteId: approval.body.id,
      })
      .expect(201);

    expect(response.body).toMatchObject({
      number: 1,
      status: 'AWAITING_ART_APPROVAL',
      subtotal: '23.33',
      discount: '0.33',
      total: '23',
      notes: 'Pedido para produção',
      quote: {
        id: approval.body.id,
        number: approval.body.number,
      },
      client: {
        id: client.id,
        name: client.name,
      },
    });

    expect(response.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: product.id,
          position: 1,
          description: 'Caneca personalizada',
          unit: 'UN',
          quantity: '1.333333',
          unitPrice: '10',
          total: '13.33',
        }),
        expect.objectContaining({
          productId: null,
          position: 2,
          description: 'Arte exclusiva',
          unit: 'UN',
          quantity: '2',
          unitPrice: '5',
          total: '10',
          notes: 'Inclusa no pedido',
        }),
      ]),
    );

    const order = await prisma.salesOrder.findUniqueOrThrow({
      where: {
        id: response.body.id,
      },
      include: {
        items: {
          orderBy: {
            position: 'asc',
          },
        },
      },
    });

    expect(order.organizationId).toBe(organizationId);
    expect(order.quoteId).toBe(approval.body.id);
    expect(order.clientId).toBe(client.id);
    expect(order.subtotal.toString()).toBe('23.33');
    expect(order.discount.toString()).toBe('0.33');
    expect(order.total.toString()).toBe('23');
    expect(order.items).toHaveLength(2);

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        action: 'order.created',
        entityId: order.id,
      },
    });

    expect(auditLog.entityType).toBe('sales_order');
  });

  it('POST should reject converting a quote that is not approved', async () => {
    const client = await createClient();

    const quote = await request(httpServer())
      .post('/api/quotes')
      .set('Cookie', sessionCookie)
      .send({
        clientId: client.id,
        items: [
          {
            description: 'Orçamento ainda em rascunho',
            unit: 'UN',
            quantity: '1',
            unitPrice: '10',
          },
        ],
      })
      .expect(201);

    const response = await request(httpServer())
      .post('/api/orders')
      .set('Cookie', sessionCookie)
      .send({
        quoteId: quote.body.id,
      })
      .expect(409);

    expect(response.body.message).toBe(
      'Apenas orçamentos aprovados podem ser convertidos em pedidos.',
    );
  });

  it('POST should not convert a quote from another organization', async () => {
    const otherOrganization = await prisma.organization.create({
      data: {
        name: 'Outra Empresa Pedidos E2E',
        slug: `other-orders-${randomUUID()}`,
      },
    });

    const otherClient = await prisma.client.create({
      data: {
        organizationId: otherOrganization.id,
        name: 'Cliente de outra organização',
      },
    });

    const foreignQuote = await prisma.financialQuote.create({
      data: {
        organizationId: otherOrganization.id,
        clientId: otherClient.id,
        number: 1,
        status: QuoteStatus.APPROVED,
        subtotal: '10',
        discount: '0',
        total: '10',
        items: {
          create: {
            position: 1,
            description: 'Item de outra organização',
            unit: 'UN',
            quantity: '1',
            unitPrice: '10',
            total: '10',
          },
        },
      },
    });

    await request(httpServer())
      .post('/api/orders')
      .set('Cookie', sessionCookie)
      .send({
        quoteId: foreignQuote.id,
      })
      .expect(404);
  });

  it('POST should serialize concurrent conversions and preserve one order per quote', async () => {
    const { quote } = await createApprovedQuote();

    const responses = await Promise.all(
      Array.from({ length: 2 }, () =>
        request(httpServer())
          .post('/api/orders')
          .set('Cookie', sessionCookie)
          .send({
            quoteId: quote.id,
          })
          .expect(201),
      ),
    );

    expect(responses[0].body.id).toBe(responses[1].body.id);

    const orderCount = await prisma.salesOrder.count({
      where: {
        organizationId,
        quoteId: quote.id,
      },
    });

    expect(orderCount).toBe(1);

    const auditCount = await prisma.auditLog.count({
      where: {
        organizationId,
        action: 'order.created',
        entityId: responses[0].body.id,
      },
    });

    expect(auditCount).toBe(1);
  });

  it('should enforce order creation permissions for every organization role', async () => {
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
          data: {
            role: OrganizationRole.OWNER,
          },
        });

        const { quote } = await createApprovedQuote();

        await prisma.organizationMember.update({
          where: membershipWhere,
          data: {
            role,
          },
        });

        await request(httpServer())
          .post('/api/orders')
          .set('Cookie', sessionCookie)
          .send({
            quoteId: quote.id,
          })
          .expect(201);
      }

      for (const role of [OrganizationRole.FINANCE, OrganizationRole.VIEWER]) {
        await prisma.organizationMember.update({
          where: membershipWhere,
          data: {
            role: OrganizationRole.OWNER,
          },
        });

        const { quote } = await createApprovedQuote();

        await prisma.organizationMember.update({
          where: membershipWhere,
          data: {
            role,
          },
        });

        await request(httpServer())
          .post('/api/orders')
          .set('Cookie', sessionCookie)
          .send({
            quoteId: quote.id,
          })
          .expect(403);
      }
    } finally {
      await prisma.organizationMember.update({
        where: membershipWhere,
        data: {
          role: OrganizationRole.OWNER,
        },
      });
    }
  });

  it('should reject unauthenticated order creation', async () => {
    await request(httpServer())
      .post('/api/orders')
      .send({
        quoteId: randomUUID(),
      })
      .expect(401);
  });
});
