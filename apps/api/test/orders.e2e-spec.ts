import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/database/prisma.service.js';
import {
  OrderStageCategory,
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

  async function createDefaultWorkflow(targetOrganizationId: string) {
    return prisma.orderWorkflow.create({
      data: {
        organizationId: targetOrganizationId,
        name: 'Fluxo padrão',
        normalizedName: 'fluxo padrao',
        isDefault: true,
        stages: {
          create: [
            {
              name: 'Pendente',
              position: 1,
              category: OrderStageCategory.PENDING,
            },
            {
              name: 'Em andamento',
              position: 2,
              category: OrderStageCategory.IN_PROGRESS,
            },
            {
              name: 'Concluído',
              position: 3,
              category: OrderStageCategory.COMPLETED,
            },
          ],
        },
      },
      include: {
        stages: {
          orderBy: {
            position: 'asc',
          },
        },
      },
    });
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
      status: 'PENDING',
      workflow: {
        name: 'Fluxo padrão',
      },
      currentStage: {
        name: 'Pendente',
        position: 1,
        category: 'PENDING',
      },
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

  it('GET should expose the linked order in quote detail and listing', async () => {
    const { quote } = await createApprovedQuote();
    const order = await createOrderFromQuote(quote.id);

    const detailResponse = await request(httpServer())
      .get(`/api/quotes/${quote.id}`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(detailResponse.body).toMatchObject({
      id: quote.id,
      status: 'APPROVED',
      order: {
        id: order.id,
        number: order.number,
        status: 'PENDING',
      },
    });

    const listResponse = await request(httpServer())
      .get('/api/quotes?status=APPROVED')
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(listResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: quote.id,
          order: {
            id: order.id,
            number: order.number,
            status: 'PENDING',
          },
        }),
      ]),
    );
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
    const inProgressOrder = await createOrderFromQuote(thirdQuote.quote.id);

    const advancement = await request(httpServer())
      .post(`/api/orders/${inProgressOrder.id}/advance`)
      .set('Cookie', sessionCookie)
      .expect(201);

    expect(advancement.body).toMatchObject({
      id: inProgressOrder.id,
      status: 'IN_PROGRESS',
      currentStage: {
        name: 'Em andamento',
        position: 2,
        category: 'IN_PROGRESS',
      },
    });

    const page = await request(httpServer())
      .get(`/api/orders?clientId=${client.id}&status=IN_PROGRESS`)
      .set('Cookie', sessionCookie)
      .expect(200);

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
      .get(`/api/orders?clientId=${client.id}&status=IN_PROGRESS`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0]).toMatchObject({
      id: inProgressOrder.id,
      status: 'IN_PROGRESS',
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
      status: 'PENDING',
      workflow: {
        name: 'Fluxo padrão',
      },
      currentStage: {
        name: 'Pendente',
        position: 1,
        category: 'PENDING',
      },
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

    const otherWorkflow = await createDefaultWorkflow(otherOrganization.id);
    const otherInitialStage = otherWorkflow.stages[0];

    if (!otherInitialStage) {
      throw new Error('Default workflow was created without an initial stage');
    }

    const foreignOrder = await prisma.salesOrder.create({
      data: {
        organizationId: otherOrganization.id,
        quoteId: otherQuote.id,
        clientId: otherClient.id,
        number: 1,
        subtotal: '10',
        discount: '0',
        total: '10',
        workflowId: otherWorkflow.id,
        currentStageId: otherInitialStage.id,
        status: OrderStatus.PENDING,
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

  it('POST should advance an order through the default workflow with history and audit records', async () => {
    const { quote } = await createApprovedQuote();
    const order = await createOrderFromQuote(quote.id);

    const inProgress = await request(httpServer())
      .post(`/api/orders/${order.id}/advance`)
      .set('Cookie', sessionCookie)
      .expect(201);

    expect(inProgress.body).toMatchObject({
      status: 'IN_PROGRESS',
      currentStage: {
        name: 'Em andamento',
        position: 2,
        category: 'IN_PROGRESS',
      },
    });

    const completion = await request(httpServer())
      .post(`/api/orders/${order.id}/advance`)
      .set('Cookie', sessionCookie)
      .expect(201);

    expect(completion.body).toMatchObject({
      status: 'COMPLETED',
      currentStage: {
        name: 'Concluído',
        position: 3,
        category: 'COMPLETED',
      },
    });

    await request(httpServer())
      .post(`/api/orders/${order.id}/advance`)
      .set('Cookie', sessionCookie)
      .expect(409);

    await request(httpServer())
      .post(`/api/orders/${order.id}/cancel`)
      .set('Cookie', sessionCookie)
      .expect(409);

    const persisted = await prisma.salesOrder.findUniqueOrThrow({
      where: {
        id: order.id,
      },
      include: {
        currentStage: true,
        stageTransitions: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    expect(persisted.status).toBe(OrderStatus.COMPLETED);
    expect(persisted.currentStage.name).toBe('Concluído');
    expect(
      persisted.stageTransitions.map((transition) => transition.type),
    ).toEqual(['CREATED', 'ADVANCED', 'ADVANCED']);

    const audits = await prisma.auditLog.findMany({
      where: {
        organizationId,
        entityId: order.id,
        action: 'order.stage_advanced',
      },
    });

    expect(audits).toHaveLength(2);
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
      .post(`/api/orders/${order.id}/advance`)
      .set('Cookie', sessionCookie)
      .expect(409);

    await request(httpServer())
      .post(`/api/orders/${order.id}/cancel`)
      .set('Cookie', sessionCookie)
      .expect(409);
  });

  it('POST should serialize concurrent stage advances and preserve one audit record', async () => {
    const { quote } = await createApprovedQuote();
    const order = await createOrderFromQuote(quote.id);

    const responses = await Promise.all(
      Array.from({ length: 2 }, () =>
        request(httpServer())
          .post(`/api/orders/${order.id}/advance`)
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

    expect(persisted.status).toBe(OrderStatus.IN_PROGRESS);

    const auditCount = await prisma.auditLog.count({
      where: {
        organizationId,
        entityId: order.id,
        action: 'order.stage_advanced',
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
          .post(`/api/orders/${order.id}/advance`)
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
          .post(`/api/orders/${order.id}/advance`)
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
      .post(`/api/orders/${randomUUID()}/advance`)
      .expect(401);
  });
});
