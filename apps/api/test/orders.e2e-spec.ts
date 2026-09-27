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

  async function createOrderFromQuote(quoteId: string, workflowId?: string) {
    const response = await request(httpServer())
      .post('/api/orders')
      .set('Cookie', sessionCookie)
      .send({
        quoteId,
        ...(workflowId ? { workflowId } : {}),
      })
      .expect(201);

    return response.body;
  }

  async function createOrderWorkflow(input?: {
    name?: string;
    stages?: string[];
  }) {
    const response = await request(httpServer())
      .post('/api/order-workflows')
      .set('Cookie', sessionCookie)
      .send({
        name: input?.name ?? `Fluxo ${randomUUID()}`,
        stages: (
          input?.stages ?? ['Recebido', 'Em execução', 'Finalizado']
        ).map((name) => ({
          name,
        })),
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

  it('should reject unauthenticated access to orders and workflow configuration', async () => {
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

    await request(httpServer()).get('/api/order-workflows').expect(401);

    await request(httpServer()).get('/api/order-workflows/active').expect(401);

    await request(httpServer())
      .post('/api/order-workflows')
      .send({
        name: 'Fluxo sem autenticação',
        stages: [{ name: 'Início' }, { name: 'Fim' }],
      })
      .expect(401);

    await request(httpServer())
      .post(`/api/order-workflows/${randomUUID()}/default`)
      .expect(401);

    await request(httpServer())
      .post(`/api/order-workflows/${randomUUID()}/deactivate`)
      .expect(401);
  });

  it('POST and GET should create and list organization workflows with derived stages', async () => {
    if (!organizationId || !userId) {
      throw new Error('Test organization was not initialized');
    }

    const workflow = await createOrderWorkflow({
      name: 'Prestação de serviços',
      stages: [
        'Solicitação recebida',
        'Executando serviço',
        'Serviço finalizado',
      ],
    });

    expect(workflow).toMatchObject({
      name: 'Prestação de serviços',
      isDefault: false,
      isActive: true,
      _count: {
        orders: 0,
      },
    });

    expect(workflow.stages).toEqual([
      expect.objectContaining({
        name: 'Solicitação recebida',
        position: 1,
        category: 'PENDING',
        isActive: true,
      }),
      expect.objectContaining({
        name: 'Executando serviço',
        position: 2,
        category: 'IN_PROGRESS',
        isActive: true,
      }),
      expect.objectContaining({
        name: 'Serviço finalizado',
        position: 3,
        category: 'COMPLETED',
        isActive: true,
      }),
    ]);

    const listResponse = await request(httpServer())
      .get('/api/order-workflows')
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(listResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Fluxo padrão',
          isDefault: true,
        }),
        expect.objectContaining({
          id: workflow.id,
          name: 'Prestação de serviços',
          isDefault: false,
        }),
      ]),
    );

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        action: 'order_workflow.created',
        entityId: workflow.id,
      },
    });

    expect(auditLog.entityType).toBe('order_workflow');
  });

  it('POST should set a workflow as default and assign it to new orders', async () => {
    if (!organizationId || !userId) {
      throw new Error('Test organization was not initialized');
    }

    const workflow = await createOrderWorkflow({
      name: 'Serviços em campo',
      stages: ['Agendado', 'Em atendimento', 'Atendimento concluído'],
    });

    const beforeResponse = await request(httpServer())
      .get('/api/order-workflows')
      .set('Cookie', sessionCookie)
      .expect(200);

    const previousDefault = beforeResponse.body.find(
      (item: { isDefault: boolean }) => item.isDefault,
    );

    expect(previousDefault).toBeDefined();

    const defaultResponse = await request(httpServer())
      .post(`/api/order-workflows/${workflow.id}/default`)
      .set('Cookie', sessionCookie)
      .expect(201);

    expect(defaultResponse.body).toMatchObject({
      id: workflow.id,
      name: 'Serviços em campo',
      isDefault: true,
      isActive: true,
    });

    const afterResponse = await request(httpServer())
      .get('/api/order-workflows')
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(
      afterResponse.body.filter(
        (item: { isDefault: boolean }) => item.isDefault,
      ),
    ).toEqual([
      expect.objectContaining({
        id: workflow.id,
      }),
    ]);

    expect(
      afterResponse.body.find(
        (item: { id: string }) => item.id === previousDefault.id,
      ),
    ).toEqual(
      expect.objectContaining({
        isDefault: false,
      }),
    );

    const { quote } = await createApprovedQuote();
    const order = await createOrderFromQuote(quote.id);

    const persistedOrder = await prisma.salesOrder.findUniqueOrThrow({
      where: {
        id: order.id,
      },
      include: {
        workflow: true,
        currentStage: true,
      },
    });

    expect(persistedOrder.workflow).toMatchObject({
      id: workflow.id,
      name: 'Serviços em campo',
    });

    expect(persistedOrder.currentStage).toMatchObject({
      name: 'Agendado',
      position: 1,
      category: OrderStageCategory.PENDING,
    });

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        action: 'order_workflow.default_changed',
        entityId: workflow.id,
      },
    });

    expect(auditLog.entityType).toBe('order_workflow');
  });

  it('POST should protect the default workflow and deactivate only non-default workflows', async () => {
    if (!organizationId || !userId) {
      throw new Error('Test organization was not initialized');
    }

    const workflowToDeactivate = await createOrderWorkflow({
      name: 'Fluxo temporário',
      stages: ['Entrada', 'Processamento', 'Saída'],
    });

    await request(httpServer())
      .post(`/api/order-workflows/${workflowToDeactivate.id}/default`)
      .set('Cookie', sessionCookie)
      .expect(201);

    const blockedDeactivation = await request(httpServer())
      .post(`/api/order-workflows/${workflowToDeactivate.id}/deactivate`)
      .set('Cookie', sessionCookie)
      .expect(409);

    expect(blockedDeactivation.body.message).toBe(
      'Defina outro fluxo como padrão antes de desativar este.',
    );

    const replacementWorkflow = await createOrderWorkflow({
      name: 'Fluxo substituto',
      stages: ['Recebido', 'Em execução', 'Concluído'],
    });

    await request(httpServer())
      .post(`/api/order-workflows/${replacementWorkflow.id}/default`)
      .set('Cookie', sessionCookie)
      .expect(201);

    const deactivationResponse = await request(httpServer())
      .post(`/api/order-workflows/${workflowToDeactivate.id}/deactivate`)
      .set('Cookie', sessionCookie)
      .expect(201);

    expect(deactivationResponse.body).toMatchObject({
      id: workflowToDeactivate.id,
      isDefault: false,
      isActive: false,
    });

    const blockedDefaultChange = await request(httpServer())
      .post(`/api/order-workflows/${workflowToDeactivate.id}/default`)
      .set('Cookie', sessionCookie)
      .expect(409);

    expect(blockedDefaultChange.body.message).toBe(
      'Não é possível definir um fluxo desativado como padrão.',
    );

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        action: 'order_workflow.deactivated',
        entityId: workflowToDeactivate.id,
      },
    });

    expect(auditLog.entityType).toBe('order_workflow');
  });

  it('should enforce order workflow configuration permissions', async () => {
    if (!organizationId || !userId) {
      throw new Error('Test membership was not initialized');
    }

    const membershipWhere = {
      organizationId_userId: {
        organizationId,
        userId,
      },
    };

    await prisma.organizationMember.update({
      where: membershipWhere,
      data: {
        role: OrganizationRole.OWNER,
      },
    });

    const protectedWorkflow = await createOrderWorkflow({
      name: `Fluxo protegido ${randomUUID()}`,
      stages: ['Entrada', 'Execução', 'Conclusão'],
    });

    try {
      for (const role of [OrganizationRole.OWNER, OrganizationRole.ADMIN]) {
        await prisma.organizationMember.update({
          where: membershipWhere,
          data: {
            role,
          },
        });

        await request(httpServer())
          .get('/api/order-workflows')
          .set('Cookie', sessionCookie)
          .expect(200);

        await request(httpServer())
          .get('/api/order-workflows/active')
          .set('Cookie', sessionCookie)
          .expect(200);

        const configurableWorkflow = await request(httpServer())
          .post('/api/order-workflows')
          .set('Cookie', sessionCookie)
          .send({
            name: `Fluxo padrão ${role} ${randomUUID()}`,
            stages: [
              { name: 'Recebido' },
              { name: 'Em andamento' },
              { name: 'Finalizado' },
            ],
          })
          .expect(201);

        await request(httpServer())
          .post(`/api/order-workflows/${configurableWorkflow.body.id}/default`)
          .set('Cookie', sessionCookie)
          .expect(201);

        const disposableWorkflow = await request(httpServer())
          .post('/api/order-workflows')
          .set('Cookie', sessionCookie)
          .send({
            name: `Fluxo descartável ${role} ${randomUUID()}`,
            stages: [{ name: 'Início' }, { name: 'Execução' }, { name: 'Fim' }],
          })
          .expect(201);

        await request(httpServer())
          .post(`/api/order-workflows/${disposableWorkflow.body.id}/deactivate`)
          .set('Cookie', sessionCookie)
          .expect(201);
      }

      for (const role of [
        OrganizationRole.OPERATIONS,
        OrganizationRole.FINANCE,
        OrganizationRole.VIEWER,
      ]) {
        await prisma.organizationMember.update({
          where: membershipWhere,
          data: {
            role,
          },
        });

        await request(httpServer())
          .get('/api/order-workflows')
          .set('Cookie', sessionCookie)
          .expect(403);

        await request(httpServer())
          .get('/api/order-workflows/active')
          .set('Cookie', sessionCookie)
          .expect(role === OrganizationRole.OPERATIONS ? 200 : 403);

        await request(httpServer())
          .post('/api/order-workflows')
          .set('Cookie', sessionCookie)
          .send({
            name: `Fluxo proibido ${role} ${randomUUID()}`,
            stages: [{ name: 'Início' }, { name: 'Fim' }],
          })
          .expect(403);

        await request(httpServer())
          .post(`/api/order-workflows/${protectedWorkflow.id}/default`)
          .set('Cookie', sessionCookie)
          .expect(403);

        await request(httpServer())
          .post(`/api/order-workflows/${protectedWorkflow.id}/deactivate`)
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

  it('POST should validate workflow names and stages', async () => {
    const workflowName = `Fluxo validação ${randomUUID()}`;

    await createOrderWorkflow({
      name: workflowName,
      stages: ['Recebido', 'Em execução', 'Concluído'],
    });

    const duplicatedName = await request(httpServer())
      .post('/api/order-workflows')
      .set('Cookie', sessionCookie)
      .send({
        name: workflowName.toUpperCase(),
        stages: [
          { name: 'Entrada' },
          { name: 'Processamento' },
          { name: 'Saída' },
        ],
      })
      .expect(409);

    expect(duplicatedName.body.message).toBe(
      'Já existe um fluxo com este nome na organização.',
    );

    const duplicatedStages = await request(httpServer())
      .post('/api/order-workflows')
      .set('Cookie', sessionCookie)
      .send({
        name: `Fluxo etapas repetidas ${randomUUID()}`,
        stages: [
          { name: 'Produção' },
          { name: ' produção ' },
          { name: 'Concluído' },
        ],
      })
      .expect(409);

    expect(duplicatedStages.body.message).toBe(
      'As etapas de um fluxo devem possuir nomes diferentes.',
    );

    await request(httpServer())
      .post('/api/order-workflows')
      .set('Cookie', sessionCookie)
      .send({
        name: `Fluxo incompleto ${randomUUID()}`,
        stages: [{ name: 'Etapa única' }],
      })
      .expect(400);

    await request(httpServer())
      .post('/api/order-workflows')
      .set('Cookie', sessionCookie)
      .send({
        name: `Fluxo excessivo ${randomUUID()}`,
        stages: Array.from({ length: 21 }, (_, index) => ({
          name: `Etapa ${index + 1}`,
        })),
      })
      .expect(400);

    await request(httpServer())
      .post('/api/order-workflows')
      .set('Cookie', sessionCookie)
      .send({
        name: '   ',
        stages: [{ name: 'Início' }, { name: 'Fim' }],
      })
      .expect(400);

    await request(httpServer())
      .post('/api/order-workflows')
      .set('Cookie', sessionCookie)
      .send({
        name: `Fluxo etapa vazia ${randomUUID()}`,
        stages: [{ name: 'Início' }, { name: '   ' }],
      })
      .expect(400);
  });

  it('should isolate order workflow configuration between organizations', async () => {
    const otherOrganization = await prisma.organization.create({
      data: {
        name: 'Outra Empresa Fluxos E2E',
        slug: `other-workflows-${randomUUID()}`,
      },
    });

    const foreignWorkflow = await createDefaultWorkflow(otherOrganization.id);

    const listResponse = await request(httpServer())
      .get('/api/order-workflows')
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(
      listResponse.body.some(
        (workflow: { id: string }) => workflow.id === foreignWorkflow.id,
      ),
    ).toBe(false);

    const defaultResponse = await request(httpServer())
      .post(`/api/order-workflows/${foreignWorkflow.id}/default`)
      .set('Cookie', sessionCookie)
      .expect(404);

    expect(defaultResponse.body.message).toBe(
      'Fluxo de pedidos não encontrado.',
    );

    const deactivationResponse = await request(httpServer())
      .post(`/api/order-workflows/${foreignWorkflow.id}/deactivate`)
      .set('Cookie', sessionCookie)
      .expect(404);

    expect(deactivationResponse.body.message).toBe(
      'Fluxo de pedidos não encontrado.',
    );

    const persistedWorkflow = await prisma.orderWorkflow.findUniqueOrThrow({
      where: {
        id: foreignWorkflow.id,
      },
    });

    expect(persistedWorkflow).toMatchObject({
      organizationId: otherOrganization.id,
      isDefault: true,
      isActive: true,
    });
  });

  it('should serialize concurrent default workflow changes', async () => {
    if (!organizationId) {
      throw new Error('Test organization was not initialized');
    }

    const firstWorkflow = await createOrderWorkflow({
      name: `Fluxo concorrente A ${randomUUID()}`,
      stages: ['Entrada', 'Execução', 'Conclusão'],
    });

    const secondWorkflow = await createOrderWorkflow({
      name: `Fluxo concorrente B ${randomUUID()}`,
      stages: ['Recebido', 'Processando', 'Finalizado'],
    });

    const responses = await Promise.all([
      request(httpServer())
        .post(`/api/order-workflows/${firstWorkflow.id}/default`)
        .set('Cookie', sessionCookie),
      request(httpServer())
        .post(`/api/order-workflows/${secondWorkflow.id}/default`)
        .set('Cookie', sessionCookie),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 201,
    ]);

    const defaultWorkflows = await prisma.orderWorkflow.findMany({
      where: {
        organizationId,
        isDefault: true,
      },
    });

    expect(defaultWorkflows).toHaveLength(1);
    expect([firstWorkflow.id, secondWorkflow.id]).toContain(
      defaultWorkflows[0]?.id,
    );

    const defaultWorkflowCount = await prisma.orderWorkflow.count({
      where: {
        organizationId,
        isDefault: true,
      },
    });

    expect(defaultWorkflowCount).toBe(1);
  });

  it('POST should assign an explicitly selected active workflow to a new order', async () => {
    if (!organizationId || !userId) {
      throw new Error('Test organization was not initialized');
    }

    const workflow = await createOrderWorkflow({
      name: `Fluxo selecionado ${randomUUID()}`,
      stages: ['Triagem', 'Execução', 'Finalização'],
    });

    const { quote } = await createApprovedQuote();
    const order = await createOrderFromQuote(quote.id, workflow.id);

    expect(order).toMatchObject({
      status: OrderStatus.PENDING,
      workflow: {
        id: workflow.id,
        name: workflow.name,
      },
      currentStage: {
        name: 'Triagem',
        position: 1,
        category: OrderStageCategory.PENDING,
      },
    });

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        action: 'order.created',
        entityId: order.id,
      },
    });

    expect(auditLog.metadata).toEqual(
      expect.objectContaining({
        workflowId: workflow.id,
        workflowName: workflow.name,
        initialStageName: 'Triagem',
      }),
    );
  });

  it('POST should reject inactive and foreign selected workflows', async () => {
    const inactiveWorkflow = await createOrderWorkflow({
      name: `Fluxo inativo ${randomUUID()}`,
      stages: ['Entrada', 'Execução', 'Saída'],
    });

    await request(httpServer())
      .post(`/api/order-workflows/${inactiveWorkflow.id}/deactivate`)
      .set('Cookie', sessionCookie)
      .expect(201);

    const inactiveQuote = await createApprovedQuote();

    const inactiveResponse = await request(httpServer())
      .post('/api/orders')
      .set('Cookie', sessionCookie)
      .send({
        quoteId: inactiveQuote.quote.id,
        workflowId: inactiveWorkflow.id,
      })
      .expect(404);

    expect(inactiveResponse.body.message).toBe(
      'Fluxo de pedidos não encontrado ou inativo.',
    );

    const otherOrganization = await prisma.organization.create({
      data: {
        name: 'Outra Empresa Fluxos Selecionados E2E',
        slug: `other-selected-workflow-${randomUUID()}`,
      },
    });

    const foreignWorkflow = await createDefaultWorkflow(otherOrganization.id);
    const foreignQuote = await createApprovedQuote();

    const foreignResponse = await request(httpServer())
      .post('/api/orders')
      .set('Cookie', sessionCookie)
      .send({
        quoteId: foreignQuote.quote.id,
        workflowId: foreignWorkflow.id,
      })
      .expect(404);

    expect(foreignResponse.body.message).toBe(
      'Fluxo de pedidos não encontrado ou inativo.',
    );
  });

  it('GET should list only active workflows available for new orders', async () => {
    const activeWorkflow = await createOrderWorkflow({
      name: `Fluxo ativo ${randomUUID()}`,
      stages: ['Recebido', 'Executando', 'Concluído'],
    });

    const inactiveWorkflow = await createOrderWorkflow({
      name: `Fluxo indisponível ${randomUUID()}`,
      stages: ['Início', 'Processamento', 'Fim'],
    });

    await request(httpServer())
      .post(`/api/order-workflows/${inactiveWorkflow.id}/deactivate`)
      .set('Cookie', sessionCookie)
      .expect(201);

    const response = await request(httpServer())
      .get('/api/order-workflows/active')
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: activeWorkflow.id,
          isActive: true,
        }),
      ]),
    );

    expect(
      response.body.some(
        (workflow: { id: string }) => workflow.id === inactiveWorkflow.id,
      ),
    ).toBe(false);

    expect(
      response.body.every(
        (workflow: { isActive: boolean }) => workflow.isActive,
      ),
    ).toBe(true);
  });
});
