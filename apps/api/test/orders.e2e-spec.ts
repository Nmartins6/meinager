import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/database/prisma.service.js';
import {
  OrderStatus,
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

  async function createApprovedQuote(
    client?: Awaited<ReturnType<typeof createClient>>,
  ) {
    const quoteClient = client ?? (await createClient());
    const creation = await request(httpServer())
      .post('/api/quotes')
      .set('Cookie', sessionCookie)
      .send({
        clientId: quoteClient.id,
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
      client: quoteClient,
      quote: approval.body,
    };
  }

  async function createOrderFromQuote(quoteId: string) {
    const response = await request(httpServer())
      .post('/api/orders')
      .set('Cookie', sessionCookie)
      .send({
        quoteId,
      })
      .expect(201);

    return response.body;
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

  it('GET should list, filter and paginate orders from the organization', async () => {
    const client = await createClient();

    const firstQuote = await createApprovedQuote(client);
    await createOrderFromQuote(firstQuote.quote.id);

    const secondQuote = await createApprovedQuote(client);
    await createOrderFromQuote(secondQuote.quote.id);

    const thirdQuote = await createApprovedQuote(client);
    const readyOrder = await createOrderFromQuote(thirdQuote.quote.id);

    await prisma.salesOrder.update({
      where: {
        id: readyOrder.id,
      },
      data: {
        status: OrderStatus.READY,
        readyAt: new Date(),
      },
    });

    const page = await request(httpServer())
      .get(`/api/orders?clientId=${client.id}&page=2&pageSize=1`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(page.body.pagination).toEqual({
      page: 2,
      pageSize: 1,
      total: 3,
      totalPages: 3,
    });

    expect(page.body.data).toHaveLength(1);
    expect(page.body.data[0]).toMatchObject({
      client: {
        id: client.id,
        name: client.name,
      },
      _count: {
        items: 1,
      },
    });

    const filtered = await request(httpServer())
      .get(`/api/orders?clientId=${client.id}&status=READY`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0]).toMatchObject({
      id: readyOrder.id,
      status: 'READY',
    });
  });

  it('GET should return an order and isolate an order from another organization', async () => {
    const { quote, client } = await createApprovedQuote();
    const order = await createOrderFromQuote(quote.id);

    const response = await request(httpServer())
      .get(`/api/orders/${order.id}`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      id: order.id,
      status: 'AWAITING_ART_APPROVAL',
      quote: {
        id: quote.id,
        number: quote.number,
      },
      client: {
        id: client.id,
        name: client.name,
      },
    });

    expect(response.body.items).toEqual([
      expect.objectContaining({
        position: 1,
        description: 'Item do pedido',
        quantity: '2',
        unitPrice: '10',
        total: '20',
      }),
    ]);

    const otherOrganization = await prisma.organization.create({
      data: {
        name: 'Outra Empresa Consulta Pedidos E2E',
        slug: `other-order-lookup-${randomUUID()}`,
      },
    });

    const otherClient = await prisma.client.create({
      data: {
        organizationId: otherOrganization.id,
        name: 'Cliente de outra organização',
      },
    });

    const otherQuote = await prisma.financialQuote.create({
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
            description: 'Item de outro orçamento',
            unit: 'UN',
            quantity: '1',
            unitPrice: '10',
            total: '10',
          },
        },
      },
    });

    const foreignOrder = await prisma.salesOrder.create({
      data: {
        organizationId: otherOrganization.id,
        quoteId: otherQuote.id,
        clientId: otherClient.id,
        number: 1,
        subtotal: '10',
        discount: '0',
        total: '10',
        items: {
          create: {
            position: 1,
            description: 'Item de outro pedido',
            unit: 'UN',
            quantity: '1',
            unitPrice: '10',
            total: '10',
          },
        },
      },
    });

    await request(httpServer())
      .get(`/api/orders/${foreignOrder.id}`)
      .set('Cookie', sessionCookie)
      .expect(404);
  });

  it('should allow finance and viewer roles to read orders', async () => {
    if (!organizationId || !userId) {
      throw new Error('Test membership was not initialized');
    }

    const membershipWhere = {
      organizationId_userId: {
        organizationId,
        userId,
      },
    };

    const { quote } = await createApprovedQuote();
    const order = await createOrderFromQuote(quote.id);

    try {
      for (const role of [OrganizationRole.FINANCE, OrganizationRole.VIEWER]) {
        await prisma.organizationMember.update({
          where: membershipWhere,
          data: {
            role,
          },
        });

        await request(httpServer())
          .get('/api/orders')
          .set('Cookie', sessionCookie)
          .expect(200);

        await request(httpServer())
          .get(`/api/orders/${order.id}`)
          .set('Cookie', sessionCookie)
          .expect(200);
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

  it('POST should progress an order through the operational lifecycle with audit records', async () => {
    const { quote } = await createApprovedQuote();
    const order = await createOrderFromQuote(quote.id);

    const artApproval = await request(httpServer())
      .post(`/api/orders/${order.id}/approve-art`)
      .set('Cookie', sessionCookie)
      .expect(201);

    expect(artApproval.body).toMatchObject({
      status: 'AWAITING_RELEASE',
      artApprovedAt: expect.any(String),
    });

    const release = await request(httpServer())
      .post(`/api/orders/${order.id}/release`)
      .set('Cookie', sessionCookie)
      .expect(201);

    expect(release.body).toMatchObject({
      status: 'IN_PRODUCTION',
      releasedAt: expect.any(String),
    });

    const ready = await request(httpServer())
      .post(`/api/orders/${order.id}/ready`)
      .set('Cookie', sessionCookie)
      .expect(201);

    expect(ready.body).toMatchObject({
      status: 'READY',
      readyAt: expect.any(String),
    });

    const delivery = await request(httpServer())
      .post(`/api/orders/${order.id}/deliver`)
      .set('Cookie', sessionCookie)
      .expect(201);

    expect(delivery.body).toMatchObject({
      status: 'DELIVERED',
      deliveredAt: expect.any(String),
    });

    await request(httpServer())
      .post(`/api/orders/${order.id}/cancel`)
      .set('Cookie', sessionCookie)
      .expect(409);

    const persisted = await prisma.salesOrder.findUniqueOrThrow({
      where: {
        id: order.id,
      },
    });

    expect(persisted.status).toBe(OrderStatus.DELIVERED);
    expect(persisted.artApprovedAt).not.toBeNull();
    expect(persisted.releasedAt).not.toBeNull();
    expect(persisted.readyAt).not.toBeNull();
    expect(persisted.deliveredAt).not.toBeNull();

    const audits = await prisma.auditLog.findMany({
      where: {
        organizationId,
        entityId: order.id,
        action: {
          in: [
            'order.art_approved',
            'order.released',
            'order.ready',
            'order.delivered',
          ],
        },
      },
    });

    expect(audits).toHaveLength(4);
    expect(audits.map((audit) => audit.action)).toEqual(
      expect.arrayContaining([
        'order.art_approved',
        'order.released',
        'order.ready',
        'order.delivered',
      ]),
    );
  });

  it('POST should cancel an order before delivery and reject further transitions', async () => {
    const { quote } = await createApprovedQuote();
    const order = await createOrderFromQuote(quote.id);

    const cancellation = await request(httpServer())
      .post(`/api/orders/${order.id}/cancel`)
      .set('Cookie', sessionCookie)
      .expect(201);

    expect(cancellation.body).toMatchObject({
      status: 'CANCELLED',
      cancelledAt: expect.any(String),
    });

    await request(httpServer())
      .post(`/api/orders/${order.id}/approve-art`)
      .set('Cookie', sessionCookie)
      .expect(409);

    await request(httpServer())
      .post(`/api/orders/${order.id}/cancel`)
      .set('Cookie', sessionCookie)
      .expect(409);
  });

  it('POST should reject invalid order lifecycle transitions', async () => {
    const { quote } = await createApprovedQuote();
    const order = await createOrderFromQuote(quote.id);

    await request(httpServer())
      .post(`/api/orders/${order.id}/release`)
      .set('Cookie', sessionCookie)
      .expect(409);

    await request(httpServer())
      .post(`/api/orders/${order.id}/ready`)
      .set('Cookie', sessionCookie)
      .expect(409);

    await request(httpServer())
      .post(`/api/orders/${order.id}/deliver`)
      .set('Cookie', sessionCookie)
      .expect(409);
  });

  it('POST should serialize concurrent art approvals and preserve one audit record', async () => {
    const { quote } = await createApprovedQuote();
    const order = await createOrderFromQuote(quote.id);

    const responses = await Promise.all(
      Array.from({ length: 2 }, () =>
        request(httpServer())
          .post(`/api/orders/${order.id}/approve-art`)
          .set('Cookie', sessionCookie),
      ),
    );

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);

    const persisted = await prisma.salesOrder.findUniqueOrThrow({
      where: {
        id: order.id,
      },
    });

    expect(persisted.status).toBe(OrderStatus.AWAITING_RELEASE);

    const auditCount = await prisma.auditLog.count({
      where: {
        organizationId,
        entityId: order.id,
        action: 'order.art_approved',
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

  it('should enforce order lifecycle permissions for every organization role', async () => {
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
        const order = await createOrderFromQuote(quote.id);

        await prisma.organizationMember.update({
          where: membershipWhere,
          data: {
            role,
          },
        });

        await request(httpServer())
          .post(`/api/orders/${order.id}/approve-art`)
          .set('Cookie', sessionCookie)
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
        const order = await createOrderFromQuote(quote.id);

        await prisma.organizationMember.update({
          where: membershipWhere,
          data: {
            role,
          },
        });

        await request(httpServer())
          .post(`/api/orders/${order.id}/approve-art`)
          .set('Cookie', sessionCookie)
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

    await request(httpServer()).get('/api/orders').expect(401);

    await request(httpServer()).get(`/api/orders/${randomUUID()}`).expect(401);

    await request(httpServer())
      .post(`/api/orders/${randomUUID()}/approve-art`)
      .expect(401);
  });
});
