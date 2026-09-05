import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/database/prisma.service.js';

describe('Financial period lifecycle (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let sessionCookie: string;
  let userId: string;
  let organizationId: string;
  let entriesPeriodId: string;
  let manualPeriodId: string;
  let pendingEntryId: string;
  let otherOrganizationId: string;
  let otherPeriodId: string;

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
        name: 'Ciclo Financeiro E2E',
        email: `period-lifecycle.${randomUUID()}@example.com`,
        password: 'senha-e2e-segura',
        organizationName: 'Empresa Ciclo Financeiro E2E',
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

    const entriesPeriodResponse = await request(app.getHttpServer())
      .post('/api/finance/periods')
      .set('Cookie', sessionCookie)
      .send({
        year: 2026,
        month: 9,
        revenueSource: 'ENTRIES',
      })
      .expect(201);

    entriesPeriodId = entriesPeriodResponse.body.id;

    const manualPeriodResponse = await request(app.getHttpServer())
      .post('/api/finance/periods')
      .set('Cookie', sessionCookie)
      .send({
        year: 2026,
        month: 8,
        revenueSource: 'MANUAL_TOTAL',
        manualRevenue: '8500.00',
      })
      .expect(201);

    manualPeriodId = manualPeriodResponse.body.id;

    const revenueCategory = await prisma.financialCategory.create({
      data: {
        organizationId,
        name: 'Vendas de teste',
        normalizedName: 'vendas de teste',
        type: 'REVENUE',
      },
    });

    const pendingEntry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: entriesPeriodId,
        categoryId: revenueCategory.id,
        description: 'Receita pendente',
        amount: '500.00',
        dueDate: new Date('2026-09-15T00:00:00.000Z'),
        status: 'PENDING',
      },
    });

    pendingEntryId = pendingEntry.id;

    const otherOrganization = await prisma.organization.create({
      data: {
        name: 'Outra Empresa Ciclo Financeiro',
        slug: `outra-ciclo-financeiro-${randomUUID()}`,
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
  });

  it('PATCH /api/finance/periods/:id should update manual revenue while open', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/finance/periods/${manualPeriodId}`)
      .set('Cookie', sessionCookie)
      .send({
        manualRevenue: '9000.75',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: manualPeriodId,
      status: 'OPEN',
      revenueSource: 'MANUAL_TOTAL',
      manualRevenue: '9000.75',
    });

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        action: 'financial_period.updated',
        entityId: manualPeriodId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    expect(auditLog.metadata).toEqual({
      previous: {
        revenueSource: 'MANUAL_TOTAL',
        manualRevenue: '8500.00',
      },
      current: {
        revenueSource: 'MANUAL_TOTAL',
        manualRevenue: '9000.75',
      },
    });
  });

  it('PATCH /api/finance/periods/:id should switch to entries and clear manual revenue', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/finance/periods/${manualPeriodId}`)
      .set('Cookie', sessionCookie)
      .send({
        revenueSource: 'ENTRIES',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: manualPeriodId,
      status: 'OPEN',
      revenueSource: 'ENTRIES',
      manualRevenue: null,
    });

    const period = await prisma.financialPeriod.findUniqueOrThrow({
      where: {
        id: manualPeriodId,
      },
    });

    expect(period.manualRevenue).toBeNull();
  });

  it('PATCH /api/finance/periods/:id should reject an empty payload', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/finance/periods/${manualPeriodId}`)
      .set('Cookie', sessionCookie)
      .send({})
      .expect(400);

    expect(response.body.message).toBe(
      'Informe ao menos um campo para atualização.',
    );
  });

  it('PATCH /api/finance/periods/:id should reject null manual revenue', async () => {
    await request(app.getHttpServer())
      .patch(`/api/finance/periods/${manualPeriodId}`)
      .set('Cookie', sessionCookie)
      .send({
        manualRevenue: null,
      })
      .expect(400);
  });

  it('PATCH /api/finance/periods/:id should reject manual revenue when active revenue entries exist', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/finance/periods/${entriesPeriodId}`)
      .set('Cookie', sessionCookie)
      .send({
        revenueSource: 'MANUAL_TOTAL',
        manualRevenue: '10000.00',
      })
      .expect(409);

    expect(response.body.message).toBe(
      'A competência possui lançamentos de receita e não pode usar receita manual.',
    );
  });

  it('POST /api/finance/periods/:id/close should close a period with pending entries', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/finance/periods/${entriesPeriodId}/close`)
      .set('Cookie', sessionCookie)
      .expect(201);

    expect(response.body).toMatchObject({
      id: entriesPeriodId,
      status: 'CLOSED',
      revenueSource: 'ENTRIES',
      manualRevenue: null,
    });

    expect(response.body.closedAt).toEqual(expect.any(String));

    const pendingEntry = await prisma.financialEntry.findUniqueOrThrow({
      where: {
        id: pendingEntryId,
      },
    });

    expect(pendingEntry.status).toBe('PENDING');

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        action: 'financial_period.closed',
        entityId: entriesPeriodId,
      },
    });

    expect(auditLog.entityType).toBe('financial_period');
  });

  it('PATCH /api/finance/periods/:id should reject changes to a closed period', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/finance/periods/${entriesPeriodId}`)
      .set('Cookie', sessionCookie)
      .send({
        revenueSource: 'ENTRIES',
      })
      .expect(400);

    expect(response.body.message).toBe(
      'Uma competência fechada não pode ser alterada.',
    );
  });

  it('POST /api/finance/periods/:id/close should reject an already closed period', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/finance/periods/${entriesPeriodId}/close`)
      .set('Cookie', sessionCookie)
      .expect(409);

    expect(response.body.message).toBe(
      'A competência financeira já está fechada.',
    );
  });

  it('POST /api/finance/periods/:id/close should not close another organization period', async () => {
    await request(app.getHttpServer())
      .post(`/api/finance/periods/${otherPeriodId}/close`)
      .set('Cookie', sessionCookie)
      .expect(404);

    const otherPeriod = await prisma.financialPeriod.findUniqueOrThrow({
      where: {
        id: otherPeriodId,
      },
    });

    expect(otherPeriod.status).toBe('OPEN');
    expect(otherPeriod.closedAt).toBeNull();
  });

  it('POST /api/finance/periods/:id/reopen should reject the FINANCE role', async () => {
    await prisma.organizationMember.update({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
      data: {
        role: 'FINANCE',
      },
    });

    try {
      await request(app.getHttpServer())
        .post(`/api/finance/periods/${entriesPeriodId}/reopen`)
        .set('Cookie', sessionCookie)
        .expect(403);
    } finally {
      await prisma.organizationMember.update({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },
        data: {
          role: 'OWNER',
        },
      });
    }
  });

  it('POST /api/finance/periods/:id/reopen should reopen a closed period for the owner', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/finance/periods/${entriesPeriodId}/reopen`)
      .set('Cookie', sessionCookie)
      .expect(201);

    expect(response.body).toMatchObject({
      id: entriesPeriodId,
      status: 'OPEN',
      closedAt: null,
    });

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        action: 'financial_period.reopened',
        entityId: entriesPeriodId,
      },
    });

    expect(auditLog.entityType).toBe('financial_period');
  });

  afterAll(async () => {
    if (otherOrganizationId) {
      await prisma.organization.delete({
        where: {
          id: otherOrganizationId,
        },
      });
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
