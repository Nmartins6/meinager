import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/database/prisma.service.js';

describe('Financial entries (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let sessionCookie: string;
  let userId: string;
  let organizationId: string;
  let openPeriodId: string;
  let manualPeriodId: string;
  let closedPeriodId: string;
  let revenueCategoryId: string;
  let fixedCategoryId: string;
  let inactiveCategoryId: string;
  let activeClientId: string;
  let inactiveClientId: string;
  let otherOrganizationId: string;
  let otherPeriodId: string;
  let otherCategoryId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    const registrationResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'Lançamentos E2E',
        email: `entries.${randomUUID()}@example.com`,
        password: 'senha-e2e-segura',
        organizationName: 'Empresa Lançamentos E2E',
      })
      .expect(201);

    userId = registrationResponse.body.user.id;
    organizationId = registrationResponse.body.organization.id;

    const setCookieHeader = registrationResponse.headers['set-cookie'];
    const setCookie = Array.isArray(setCookieHeader)
      ? setCookieHeader[0]
      : setCookieHeader;

    if (!setCookie) {
      throw new Error('Session cookie was not returned');
    }

    sessionCookie = setCookie.split(';', 1)[0]!;

    const openPeriod = await prisma.financialPeriod.create({
      data: {
        organizationId,
        year: 2026,
        month: 9,
        revenueSource: 'ENTRIES',
      },
    });

    openPeriodId = openPeriod.id;

    const manualPeriod = await prisma.financialPeriod.create({
      data: {
        organizationId,
        year: 2026,
        month: 8,
        revenueSource: 'MANUAL_TOTAL',
        manualRevenue: '5000.00',
      },
    });

    manualPeriodId = manualPeriod.id;

    const closedPeriod = await prisma.financialPeriod.create({
      data: {
        organizationId,
        year: 2026,
        month: 7,
        status: 'CLOSED',
        revenueSource: 'ENTRIES',
        closedAt: new Date(),
      },
    });

    closedPeriodId = closedPeriod.id;

    const revenueCategory = await prisma.financialCategory.create({
      data: {
        organizationId,
        name: 'Vendas',
        normalizedName: 'vendas',
        type: 'REVENUE',
      },
    });

    revenueCategoryId = revenueCategory.id;

    const fixedCategory = await prisma.financialCategory.create({
      data: {
        organizationId,
        name: 'Aluguel',
        normalizedName: 'aluguel',
        type: 'FIXED_EXPENSE',
      },
    });

    fixedCategoryId = fixedCategory.id;

    const inactiveCategory = await prisma.financialCategory.create({
      data: {
        organizationId,
        name: 'Categoria inativa',
        normalizedName: 'categoria inativa',
        type: 'VARIABLE_EXPENSE',
        isActive: false,
      },
    });

    inactiveCategoryId = inactiveCategory.id;

    const activeClient = await prisma.client.create({
      data: {
        organizationId,
        name: 'Cliente ativo',
      },
    });

    activeClientId = activeClient.id;

    const inactiveClient = await prisma.client.create({
      data: {
        organizationId,
        name: 'Cliente inativo',
        isActive: false,
      },
    });

    inactiveClientId = inactiveClient.id;

    const otherOrganization = await prisma.organization.create({
      data: {
        name: 'Outra Empresa Lançamentos',
        slug: `outra-lancamentos-${randomUUID()}`,
      },
    });

    otherOrganizationId = otherOrganization.id;

    const otherPeriod = await prisma.financialPeriod.create({
      data: {
        organizationId: otherOrganization.id,
        year: 2026,
        month: 9,
        revenueSource: 'ENTRIES',
      },
    });

    otherPeriodId = otherPeriod.id;

    const otherCategory = await prisma.financialCategory.create({
      data: {
        organizationId: otherOrganization.id,
        name: 'Vendas externas',
        normalizedName: 'vendas externas',
        type: 'REVENUE',
      },
    });

    otherCategoryId = otherCategory.id;

    await prisma.financialEntry.create({
      data: {
        organizationId: otherOrganization.id,
        periodId: otherPeriod.id,
        categoryId: otherCategory.id,
        description: 'Venda filtro isolado externa',
        amount: '9999.99',
        dueDate: new Date('2026-09-10T00:00:00.000Z'),
      },
    });
  });

  it('POST /api/finance/entries should create a pending manual entry', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/finance/entries')
      .set('Cookie', sessionCookie)
      .send({
        periodId: openPeriodId,
        categoryId: revenueCategoryId,
        clientId: activeClientId,
        description: '  Venda de setembro  ',
        amount: '1250.5',
        dueDate: '2026-09-10',
        notes: '  Primeira venda do período  ',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      description: 'Venda de setembro',
      amount: '1250.50',
      dueDate: '2026-09-10',
      status: 'PENDING',
      origin: 'MANUAL',
      sourceEntryId: null,
      notes: 'Primeira venda do período',
      period: {
        id: openPeriodId,
        year: 2026,
        month: 9,
        status: 'OPEN',
      },
      category: {
        id: revenueCategoryId,
        name: 'Vendas',
        type: 'REVENUE',
      },
      client: {
        id: activeClientId,
        name: 'Cliente ativo',
        type: 'INDIVIDUAL',
      },
    });

    const persistedEntry = await prisma.financialEntry.findUniqueOrThrow({
      where: {
        id: response.body.id,
      },
    });

    expect(persistedEntry.organizationId).toBe(organizationId);
    expect(persistedEntry.amount.toFixed(2)).toBe('1250.50');
    expect(persistedEntry.status).toBe('PENDING');
    expect(persistedEntry.origin).toBe('MANUAL');

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        action: 'financial_entry.created',
        entityId: response.body.id,
      },
    });

    expect(auditLog.metadata).toEqual({
      amount: '1250.50',
      dueDate: '2026-09-10',
      categoryId: revenueCategoryId,
      clientId: activeClientId,
    });
  });

  it('POST /api/finance/entries should create an expense without a client', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/finance/entries')
      .set('Cookie', sessionCookie)
      .send({
        periodId: openPeriodId,
        categoryId: fixedCategoryId,
        description: 'Aluguel de setembro',
        amount: '800.00',
        dueDate: '2026-09-05',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      description: 'Aluguel de setembro',
      amount: '800.00',
      status: 'PENDING',
      origin: 'MANUAL',
      client: null,
      category: {
        type: 'FIXED_EXPENSE',
      },
    });
  });

  it('GET /api/finance/entries should filter, paginate and isolate entries', async () => {
    await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: openPeriodId,
        categoryId: revenueCategoryId,
        description: 'Venda filtro isolado',
        amount: '321.00',
        dueDate: new Date('2026-09-20T00:00:00.000Z'),
      },
    });

    const response = await request(app.getHttpServer())
      .get('/api/finance/entries')
      .query({
        search: 'filtro isolado',
        categoryType: 'REVENUE',
        status: 'PENDING',
        dueFrom: '2026-09-01',
        dueTo: '2026-09-30',
        page: 1,
        pageSize: 10,
      })
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(response.body.pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      description: 'Venda filtro isolado',
      amount: '321.00',
    });

    expect(
      response.body.data.some(
        (entry: { description: string }) =>
          entry.description === 'Venda filtro isolado externa',
      ),
    ).toBe(false);
  });

  it('POST /api/finance/entries should reject zero and protected fields', async () => {
    await request(app.getHttpServer())
      .post('/api/finance/entries')
      .set('Cookie', sessionCookie)
      .send({
        periodId: openPeriodId,
        categoryId: fixedCategoryId,
        description: 'Lançamento inválido',
        amount: '0.00',
        dueDate: '2026-09-10',
        organizationId: randomUUID(),
        status: 'SETTLED',
        origin: 'ORDER',
      })
      .expect(400);
  });

  it('POST /api/finance/entries should require the due date to belong to the period', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/finance/entries')
      .set('Cookie', sessionCookie)
      .send({
        periodId: openPeriodId,
        categoryId: fixedCategoryId,
        description: 'Vencimento incorreto',
        amount: '100.00',
        dueDate: '2026-10-01',
      })
      .expect(400);

    expect(response.body.message).toBe(
      'A data de vencimento deve pertencer à competência informada.',
    );
  });

  it('POST /api/finance/entries should reject a closed period', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/finance/entries')
      .set('Cookie', sessionCookie)
      .send({
        periodId: closedPeriodId,
        categoryId: fixedCategoryId,
        description: 'Despesa em período fechado',
        amount: '100.00',
        dueDate: '2026-07-10',
      })
      .expect(400);

    expect(response.body.message).toBe(
      'Não é possível criar lançamentos em uma competência fechada.',
    );
  });

  it('POST /api/finance/entries should reject revenue in a manual-revenue period', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/finance/entries')
      .set('Cookie', sessionCookie)
      .send({
        periodId: manualPeriodId,
        categoryId: revenueCategoryId,
        description: 'Receita duplicada',
        amount: '500.00',
        dueDate: '2026-08-10',
      })
      .expect(409);

    expect(response.body.message).toBe(
      'Esta competência usa receita manual e não aceita lançamentos de receita.',
    );
  });

  it('POST /api/finance/entries should reject an inactive category', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/finance/entries')
      .set('Cookie', sessionCookie)
      .send({
        periodId: openPeriodId,
        categoryId: inactiveCategoryId,
        description: 'Categoria inativa',
        amount: '100.00',
        dueDate: '2026-09-10',
      })
      .expect(400);

    expect(response.body.message).toBe(
      'Não é possível usar uma categoria financeira inativa.',
    );
  });

  it('POST /api/finance/entries should reject an inactive client', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/finance/entries')
      .set('Cookie', sessionCookie)
      .send({
        periodId: openPeriodId,
        categoryId: revenueCategoryId,
        clientId: inactiveClientId,
        description: 'Venda para cliente inativo',
        amount: '100.00',
        dueDate: '2026-09-10',
      })
      .expect(400);

    expect(response.body.message).toBe(
      'Não é possível vincular um cliente inativo.',
    );
  });

  it('POST /api/finance/entries should not use another organization period', async () => {
    await request(app.getHttpServer())
      .post('/api/finance/entries')
      .set('Cookie', sessionCookie)
      .send({
        periodId: otherPeriodId,
        categoryId: revenueCategoryId,
        description: 'Período externo',
        amount: '100.00',
        dueDate: '2026-09-10',
      })
      .expect(404);
  });

  it('POST /api/finance/entries should not use another organization category', async () => {
    await request(app.getHttpServer())
      .post('/api/finance/entries')
      .set('Cookie', sessionCookie)
      .send({
        periodId: openPeriodId,
        categoryId: otherCategoryId,
        description: 'Categoria externa',
        amount: '100.00',
        dueDate: '2026-09-10',
      })
      .expect(404);
  });

  it('should reject an unauthenticated request', async () => {
    await request(app.getHttpServer()).get('/api/finance/entries').expect(401);
  });

  afterAll(async () => {
    if (otherOrganizationId) {
      await prisma.$transaction([
        prisma.financialEntry.deleteMany({
          where: {
            organizationId: otherOrganizationId,
          },
        }),
        prisma.financialCategory.deleteMany({
          where: {
            organizationId: otherOrganizationId,
          },
        }),
        prisma.financialPeriod.deleteMany({
          where: {
            organizationId: otherOrganizationId,
          },
        }),
        prisma.organization.delete({
          where: {
            id: otherOrganizationId,
          },
        }),
      ]);
    }

    if (organizationId && userId) {
      await prisma.$transaction([
        prisma.financialEntry.deleteMany({
          where: {
            organizationId,
          },
        }),
        prisma.financialCategory.deleteMany({
          where: {
            organizationId,
          },
        }),
        prisma.financialPeriod.deleteMany({
          where: {
            organizationId,
          },
        }),
        prisma.client.deleteMany({
          where: {
            organizationId,
          },
        }),
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
        prisma.user.delete({
          where: {
            id: userId,
          },
        }),
      ]);
    }

    await app.close();
  });
});
