// apps/api/test/quotes.e2e-spec.ts
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

describe('Quotes (e2e)', () => {
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

  function currentOrganizationId() {
    if (!organizationId) {
      throw new Error('Organization was not initialized');
    }

    return organizationId;
  }

  async function createClient(isActive = true) {
    const name = `Cliente orçamento ${randomUUID()}`;

    return prisma.client.create({
      data: {
        organizationId: currentOrganizationId(),
        name,
        isActive,
      },
    });
  }

  async function createProduct(isActive = true) {
    const name = `Produto orçamento ${randomUUID()}`;

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
        name: 'Orçamentos E2E',
        email: `quotes.${randomUUID()}@example.com`,
        password: 'senha-e2e-segura',
        organizationName: 'Empresa Orçamentos E2E',
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

    const otherOrganization = await prisma.organization.create({
      data: {
        name: 'Outra Empresa Orçamentos E2E',
        slug: `other-quotes-${randomUUID()}`,
      },
    });

    otherOrganizationId = otherOrganization.id;
  });

  it('POST should calculate totals, preserve item snapshots and number the quote', async () => {
    const client = await createClient();
    const product = await createProduct();

    const response = await request(httpServer())
      .post('/api/quotes')
      .set('Cookie', sessionCookie)
      .send({
        clientId: client.id,
        validUntil: '2026-10-15',
        discount: '0.33',
        notes: '  Orçamento para aprovação  ',
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

    expect(response.body).toMatchObject({
      number: 1,
      status: 'DRAFT',
      client: {
        id: client.id,
        name: client.name,
      },
      subtotal: '23.33',
      discount: '0.33',
      total: '23',
      notes: 'Orçamento para aprovação',
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

    const quote = await prisma.financialQuote.findUniqueOrThrow({
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

    expect(quote.organizationId).toBe(organizationId);
    expect(quote.number).toBe(1);
    expect(quote.subtotal.toString()).toBe('23.33');
    expect(quote.discount.toString()).toBe('0.33');
    expect(quote.total.toString()).toBe('23');
    expect(quote.items).toHaveLength(2);

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        action: 'quote.created',
        entityId: quote.id,
      },
    });

    expect(auditLog.entityType).toBe('financial_quote');
  });

  it('POST should generate sequential numbers per organization', async () => {
    const client = await createClient();

    const first = await request(httpServer())
      .post('/api/quotes')
      .set('Cookie', sessionCookie)
      .send({
        clientId: client.id,
        items: [
          {
            description: 'Item sequencial um',
            unit: 'UN',
            quantity: '1',
            unitPrice: '10',
          },
        ],
      })
      .expect(201);

    const second = await request(httpServer())
      .post('/api/quotes')
      .set('Cookie', sessionCookie)
      .send({
        clientId: client.id,
        items: [
          {
            description: 'Item sequencial dois',
            unit: 'UN',
            quantity: '1',
            unitPrice: '20',
          },
        ],
      })
      .expect(201);

    expect(second.body.number).toBe(first.body.number + 1);
  });

  it('GET should list, filter and paginate quotes from the organization', async () => {
    const client = await createClient();

    await request(httpServer())
      .post('/api/quotes')
      .set('Cookie', sessionCookie)
      .send({
        clientId: client.id,
        items: [
          {
            description: 'Item para listagem',
            unit: 'UN',
            quantity: '1',
            unitPrice: '15',
          },
        ],
      })
      .expect(201);

    const response = await request(httpServer())
      .get('/api/quotes')
      .query({
        clientId: client.id,
        status: 'DRAFT',
        page: 1,
        pageSize: 1,
      })
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      client: {
        id: client.id,
      },
      status: 'DRAFT',
    });
    expect(response.body.pagination).toMatchObject({
      page: 1,
      pageSize: 1,
      total: expect.any(Number),
      totalPages: expect.any(Number),
    });
    expect(response.body.pagination.total).toBeGreaterThanOrEqual(1);
  });

  it('GET should isolate quotes from another organization', async () => {
    if (!otherOrganizationId) {
      throw new Error('Other organization was not initialized');
    }

    const externalClient = await prisma.client.create({
      data: {
        organizationId: otherOrganizationId,
        name: 'Cliente externo',
      },
    });

    const externalQuote = await prisma.financialQuote.create({
      data: {
        organizationId: otherOrganizationId,
        clientId: externalClient.id,
        number: 1,
      },
    });

    await request(httpServer())
      .get(`/api/quotes/${externalQuote.id}`)
      .set('Cookie', sessionCookie)
      .expect(404);

    const response = await request(httpServer())
      .get('/api/quotes')
      .query({
        clientId: externalClient.id,
      })
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(response.body.data).toEqual([]);
    expect(response.body.pagination.total).toBe(0);

    await request(httpServer())
      .patch(`/api/quotes/${externalQuote.id}`)
      .set('Cookie', sessionCookie)
      .send({
        notes: 'Tentativa externa',
      })
      .expect(404);
  });

  it('POST should reject inactive resources and a discount greater than subtotal', async () => {
    const inactiveClient = await createClient(false);
    const activeClient = await createClient();
    const inactiveProduct = await createProduct(false);

    await request(httpServer())
      .post('/api/quotes')
      .set('Cookie', sessionCookie)
      .send({
        clientId: inactiveClient.id,
        items: [
          {
            description: 'Item inválido',
            unit: 'UN',
            quantity: '1',
            unitPrice: '10',
          },
        ],
      })
      .expect(404);

    await request(httpServer())
      .post('/api/quotes')
      .set('Cookie', sessionCookie)
      .send({
        clientId: activeClient.id,
        items: [
          {
            productId: inactiveProduct.id,
            description: 'Produto inativo',
            unit: 'UN',
            quantity: '1',
            unitPrice: '10',
          },
        ],
      })
      .expect(400);

    await request(httpServer())
      .post('/api/quotes')
      .set('Cookie', sessionCookie)
      .send({
        clientId: activeClient.id,
        discount: '10.01',
        items: [
          {
            description: 'Desconto inválido',
            unit: 'UN',
            quantity: '1',
            unitPrice: '10',
          },
        ],
      })
      .expect(400);
  });

  it('POST should reject protected totals and status fields', async () => {
    const client = await createClient();

    await request(httpServer())
      .post('/api/quotes')
      .set('Cookie', sessionCookie)
      .send({
        clientId: client.id,
        status: 'APPROVED',
        subtotal: '999',
        total: '999',
        items: [
          {
            description: 'Item protegido',
            unit: 'UN',
            quantity: '1',
            unitPrice: '10',
            total: '999',
          },
        ],
      })
      .expect(400);
  });

  it('POST should serialize concurrent quote creation and preserve numbering', async () => {
    const client = await createClient();

    const responses = await Promise.all(
      ['um', 'dois'].map((suffix) =>
        request(httpServer())
          .post('/api/quotes')
          .set('Cookie', sessionCookie)
          .send({
            clientId: client.id,
            items: [
              {
                description: `Orçamento concorrente ${suffix}`,
                unit: 'UN',
                quantity: '1',
                unitPrice: '10',
              },
            ],
          })
          .expect(201),
      ),
    );

    const numbers = responses
      .map((response) => response.body.number)
      .sort((left, right) => left - right);

    expect(numbers).toHaveLength(2);
    expect(numbers[1]).toBe(numbers[0] + 1);
  });

  it('should enforce quote permissions for every organization role', async () => {
    if (!organizationId || !userId) {
      throw new Error('Test membership was not initialized');
    }

    const membershipWhere = {
      organizationId_userId: {
        organizationId,
        userId,
      },
    };

    const client = await createClient();

    const payload = {
      clientId: client.id,
      items: [
        {
          description: 'Item sujeito a permissões',
          unit: 'UN',
          quantity: '1',
          unitPrice: '10',
        },
      ],
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

        await request(httpServer())
          .post('/api/quotes')
          .set('Cookie', sessionCookie)
          .send({
            ...payload,
            items: [
              {
                ...payload.items[0],
                description: `Orçamento criado por ${role}`,
              },
            ],
          })
          .expect(201);
      }

      await prisma.organizationMember.update({
        where: membershipWhere,
        data: { role: OrganizationRole.OWNER },
      });

      const quoteToRead = await request(httpServer())
        .post('/api/quotes')
        .set('Cookie', sessionCookie)
        .send(payload)
        .expect(201);

      for (const role of [OrganizationRole.FINANCE, OrganizationRole.VIEWER]) {
        await prisma.organizationMember.update({
          where: membershipWhere,
          data: { role },
        });

        await request(httpServer())
          .get('/api/quotes')
          .set('Cookie', sessionCookie)
          .expect(200);

        await request(httpServer())
          .get(`/api/quotes/${quoteToRead.body.id}`)
          .set('Cookie', sessionCookie)
          .expect(200);

        await request(httpServer())
          .post('/api/quotes')
          .set('Cookie', sessionCookie)
          .send(payload)
          .expect(403);
      }
    } finally {
      await prisma.organizationMember.update({
        where: membershipWhere,
        data: { role: OrganizationRole.OWNER },
      });
    }
  });

  it('should reject unauthenticated quote requests', async () => {
    await request(httpServer()).get('/api/quotes').expect(401);

    await request(httpServer())
      .post('/api/quotes')
      .send({
        clientId: randomUUID(),
        items: [
          {
            description: 'Orçamento não autorizado',
            unit: 'UN',
            quantity: '1',
            unitPrice: '10',
          },
        ],
      })
      .expect(401);
  });

  it('POST should send and approve a quote with audit records', async () => {
    const client = await createClient();

    const creation = await request(httpServer())
      .post('/api/quotes')
      .set('Cookie', sessionCookie)
      .send({
        clientId: client.id,
        items: [
          {
            description: 'Item para aprovação',
            unit: 'UN',
            quantity: '1',
            unitPrice: '100',
          },
        ],
      })
      .expect(201);

    const sent = await request(httpServer())
      .post(`/api/quotes/${creation.body.id}/send`)
      .set('Cookie', sessionCookie)
      .expect(201);

    expect(sent.body).toMatchObject({
      id: creation.body.id,
      status: 'SENT',
      sentAt: expect.any(String),
    });

    const approved = await request(httpServer())
      .post(`/api/quotes/${creation.body.id}/approve`)
      .set('Cookie', sessionCookie)
      .expect(201);

    expect(approved.body).toMatchObject({
      id: creation.body.id,
      status: 'APPROVED',
      sentAt: expect.any(String),
      approvedAt: expect.any(String),
    });

    const auditActions = await prisma.auditLog.findMany({
      where: {
        organizationId,
        entityId: creation.body.id,
      },
      select: {
        action: true,
      },
    });

    expect(auditActions.map((audit) => audit.action)).toEqual(
      expect.arrayContaining(['quote.created', 'quote.sent', 'quote.approved']),
    );
  });

  it('POST should reject a sent quote and cancel a draft quote', async () => {
    const client = await createClient();

    const draft = await request(httpServer())
      .post('/api/quotes')
      .set('Cookie', sessionCookie)
      .send({
        clientId: client.id,
        items: [
          {
            description: 'Item para cancelamento',
            unit: 'UN',
            quantity: '1',
            unitPrice: '10',
          },
        ],
      })
      .expect(201);

    const cancelled = await request(httpServer())
      .post(`/api/quotes/${draft.body.id}/cancel`)
      .set('Cookie', sessionCookie)
      .expect(201);

    expect(cancelled.body).toMatchObject({
      status: 'CANCELLED',
      cancelledAt: expect.any(String),
    });

    const quoteToReject = await request(httpServer())
      .post('/api/quotes')
      .set('Cookie', sessionCookie)
      .send({
        clientId: client.id,
        items: [
          {
            description: 'Item para rejeição',
            unit: 'UN',
            quantity: '1',
            unitPrice: '10',
          },
        ],
      })
      .expect(201);

    await request(httpServer())
      .post(`/api/quotes/${quoteToReject.body.id}/send`)
      .set('Cookie', sessionCookie)
      .expect(201);

    const rejected = await request(httpServer())
      .post(`/api/quotes/${quoteToReject.body.id}/reject`)
      .set('Cookie', sessionCookie)
      .expect(201);

    expect(rejected.body).toMatchObject({
      status: 'REJECTED',
      rejectedAt: expect.any(String),
    });
  });

  it('POST should reject invalid quote status transitions', async () => {
    const client = await createClient();

    const creation = await request(httpServer())
      .post('/api/quotes')
      .set('Cookie', sessionCookie)
      .send({
        clientId: client.id,
        items: [
          {
            description: 'Item com transição inválida',
            unit: 'UN',
            quantity: '1',
            unitPrice: '10',
          },
        ],
      })
      .expect(201);

    await request(httpServer())
      .post(`/api/quotes/${creation.body.id}/approve`)
      .set('Cookie', sessionCookie)
      .expect(409);

    await request(httpServer())
      .post(`/api/quotes/${creation.body.id}/send`)
      .set('Cookie', sessionCookie)
      .expect(201);

    await request(httpServer())
      .post(`/api/quotes/${creation.body.id}/send`)
      .set('Cookie', sessionCookie)
      .expect(409);

    await request(httpServer())
      .post(`/api/quotes/${creation.body.id}/reject`)
      .set('Cookie', sessionCookie)
      .expect(201);

    await request(httpServer())
      .post(`/api/quotes/${creation.body.id}/cancel`)
      .set('Cookie', sessionCookie)
      .expect(409);
  });

  it('GET should automatically expire an overdue sent quote', async () => {
    const client = await createClient();

    const lastQuote = await prisma.financialQuote.aggregate({
      where: {
        organizationId: currentOrganizationId(),
      },
      _max: {
        number: true,
      },
    });

    const quote = await prisma.financialQuote.create({
      data: {
        organizationId: currentOrganizationId(),
        clientId: client.id,
        number: (lastQuote._max.number ?? 0) + 1,
        status: QuoteStatus.SENT,
        validUntil: new Date('2000-01-01T00:00:00.000Z'),
        subtotal: '0',
        discount: '0',
        total: '0',
        sentAt: new Date('2000-01-01T00:00:00.000Z'),
      },
    });

    const response = await request(httpServer())
      .get('/api/quotes')
      .query({
        status: QuoteStatus.EXPIRED,
      })
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: quote.id,
          status: QuoteStatus.EXPIRED,
        }),
      ]),
    );

    const persisted = await prisma.financialQuote.findUniqueOrThrow({
      where: {
        id: quote.id,
      },
    });

    expect(persisted.status).toBe(QuoteStatus.EXPIRED);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        entityId: quote.id,
        action: 'quote.expired',
      },
    });

    expect(audit.entityType).toBe('financial_quote');
  });

  it('POST should serialize concurrent sends and keep a single audit record', async () => {
    const client = await createClient();

    const quote = await request(httpServer())
      .post('/api/quotes')
      .set('Cookie', sessionCookie)
      .send({
        clientId: client.id,
        items: [
          {
            description: 'Orçamento para envio concorrente',
            unit: 'UN',
            quantity: '1',
            unitPrice: '10',
          },
        ],
      })
      .expect(201);

    const responses = await Promise.all(
      Array.from({ length: 2 }, () =>
        request(httpServer())
          .post(`/api/quotes/${quote.body.id}/send`)
          .set('Cookie', sessionCookie),
      ),
    );

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);

    const auditCount = await prisma.auditLog.count({
      where: {
        organizationId,
        entityId: quote.body.id,
        action: 'quote.sent',
      },
    });

    expect(auditCount).toBe(1);
  });

  it('should enforce quote lifecycle permissions', async () => {
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

        const client = await createClient();

        const quote = await request(httpServer())
          .post('/api/quotes')
          .set('Cookie', sessionCookie)
          .send({
            clientId: client.id,
            items: [
              {
                description: `Orçamento enviado por ${role}`,
                unit: 'UN',
                quantity: '1',
                unitPrice: '10',
              },
            ],
          })
          .expect(201);

        await request(httpServer())
          .post(`/api/quotes/${quote.body.id}/send`)
          .set('Cookie', sessionCookie)
          .expect(201);
      }

      await prisma.organizationMember.update({
        where: membershipWhere,
        data: { role: OrganizationRole.OWNER },
      });

      const client = await createClient();
      const protectedQuote = await request(httpServer())
        .post('/api/quotes')
        .set('Cookie', sessionCookie)
        .send({
          clientId: client.id,
          items: [
            {
              description: 'Orçamento protegido',
              unit: 'UN',
              quantity: '1',
              unitPrice: '10',
            },
          ],
        })
        .expect(201);

      for (const role of [OrganizationRole.FINANCE, OrganizationRole.VIEWER]) {
        await prisma.organizationMember.update({
          where: membershipWhere,
          data: { role },
        });

        await request(httpServer())
          .get(`/api/quotes/${protectedQuote.body.id}`)
          .set('Cookie', sessionCookie)
          .expect(200);

        await request(httpServer())
          .post(`/api/quotes/${protectedQuote.body.id}/send`)
          .set('Cookie', sessionCookie)
          .expect(403);
      }
    } finally {
      await prisma.organizationMember.update({
        where: membershipWhere,
        data: { role: OrganizationRole.OWNER },
      });
    }
  });

  it('PATCH should replace draft items and recalculate totals', async () => {
    const originalClient = await createClient();
    const updatedClient = await createClient();
    const product = await createProduct();

    const creation = await request(httpServer())
      .post('/api/quotes')
      .set('Cookie', sessionCookie)
      .send({
        clientId: originalClient.id,
        validUntil: '2027-01-10',
        discount: '2',
        notes: 'Observação original',
        items: [
          {
            description: 'Item original',
            unit: 'UN',
            quantity: '1',
            unitPrice: '10',
          },
        ],
      })
      .expect(201);

    const response = await request(httpServer())
      .patch(`/api/quotes/${creation.body.id}`)
      .set('Cookie', sessionCookie)
      .send({
        clientId: updatedClient.id,
        validUntil: null,
        discount: '1.2',
        notes: null,
        items: [
          {
            productId: product.id,
            description: 'Item atualizado',
            unit: 'UN',
            quantity: '2.5',
            unitPrice: '10.01',
            notes: 'Novo item do orçamento',
          },
        ],
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: creation.body.id,
      status: 'DRAFT',
      validUntil: null,
      subtotal: '25.03',
      total: '23.83',
      notes: null,
      client: {
        id: updatedClient.id,
      },
    });

    expect(response.body.items).toEqual([
      expect.objectContaining({
        productId: product.id,
        position: 1,
        description: 'Item atualizado',
        quantity: '2.5',
        unitPrice: '10.01',
        total: '25.03',
        notes: 'Novo item do orçamento',
      }),
    ]);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        entityId: creation.body.id,
        action: 'quote.updated',
      },
    });

    expect(audit.entityType).toBe('financial_quote');
  });

  it('PATCH should preserve items and clear the discount on a draft quote', async () => {
    const client = await createClient();

    const creation = await request(httpServer())
      .post('/api/quotes')
      .set('Cookie', sessionCookie)
      .send({
        clientId: client.id,
        discount: '2',
        notes: 'Observação removível',
        items: [
          {
            description: 'Item preservado',
            unit: 'UN',
            quantity: '1',
            unitPrice: '10',
          },
        ],
      })
      .expect(201);

    const response = await request(httpServer())
      .patch(`/api/quotes/${creation.body.id}`)
      .set('Cookie', sessionCookie)
      .send({
        discount: null,
        notes: null,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      discount: '0',
      subtotal: '10',
      total: '10',
      notes: null,
    });
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].description).toBe('Item preservado');
  });

  it('PATCH should reject empty payloads, inactive products and sent quotes', async () => {
    const client = await createClient();
    const inactiveProduct = await createProduct(false);

    const creation = await request(httpServer())
      .post('/api/quotes')
      .set('Cookie', sessionCookie)
      .send({
        clientId: client.id,
        items: [
          {
            description: 'Item com atualização inválida',
            unit: 'UN',
            quantity: '1',
            unitPrice: '10',
          },
        ],
      })
      .expect(201);

    await request(httpServer())
      .patch(`/api/quotes/${creation.body.id}`)
      .set('Cookie', sessionCookie)
      .send({})
      .expect(400);

    await request(httpServer())
      .patch(`/api/quotes/${creation.body.id}`)
      .set('Cookie', sessionCookie)
      .send({
        items: [
          {
            productId: inactiveProduct.id,
            description: 'Produto inativo',
            unit: 'UN',
            quantity: '1',
            unitPrice: '10',
          },
        ],
      })
      .expect(400);

    await request(httpServer())
      .post(`/api/quotes/${creation.body.id}/send`)
      .set('Cookie', sessionCookie)
      .expect(201);

    await request(httpServer())
      .patch(`/api/quotes/${creation.body.id}`)
      .set('Cookie', sessionCookie)
      .send({
        notes: 'Alteração proibida',
      })
      .expect(409);
  });

  it('should reject unauthenticated quote lifecycle actions', async () => {
    await request(httpServer())
      .post(`/api/quotes/${randomUUID()}/send`)
      .expect(401);

    await request(httpServer())
      .patch(`/api/quotes/${randomUUID()}`)
      .send({
        notes: 'Tentativa não autorizada',
      })
      .expect(401);
  });

  afterAll(async () => {
    await app?.close();
  });
});
