import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/database/prisma.service.js';

describe('Financial period summary (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let sessionCookie: string;
  let userId: string;
  let organizationId: string;
  let revenueCategoryId: string;
  let fixedCategoryId: string;
  let variableCategoryId: string;
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
        name: 'Resumo Financeiro E2E',
        email: `summary.${randomUUID()}@example.com`,
        password: 'senha-e2e-segura',
        organizationName: 'Empresa Resumo E2E',
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

    const revenueCategory = await prisma.financialCategory.create({
      data: {
        organizationId,
        name: 'Receitas do resumo',
        normalizedName: 'receitas do resumo',
        type: 'REVENUE',
      },
    });

    revenueCategoryId = revenueCategory.id;

    const fixedCategory = await prisma.financialCategory.create({
      data: {
        organizationId,
        name: 'Custos fixos do resumo',
        normalizedName: 'custos fixos do resumo',
        type: 'FIXED_EXPENSE',
      },
    });

    fixedCategoryId = fixedCategory.id;

    const variableCategory = await prisma.financialCategory.create({
      data: {
        organizationId,
        name: 'Custos variáveis do resumo',
        normalizedName: 'custos variaveis do resumo',
        type: 'VARIABLE_EXPENSE',
      },
    });

    variableCategoryId = variableCategory.id;

    const otherOrganization = await prisma.organization.create({
      data: {
        name: 'Outra Empresa Resumo',
        slug: `outra-empresa-resumo-${randomUUID()}`,
      },
    });

    otherOrganizationId = otherOrganization.id;

    const otherPeriod = await prisma.financialPeriod.create({
      data: {
        organizationId: otherOrganizationId,
        year: 2026,
        month: 1,
        revenueSource: 'ENTRIES',
      },
    });

    otherPeriodId = otherPeriod.id;
  });

  it('GET should calculate an entry-based positive result', async () => {
    const period = await prisma.financialPeriod.create({
      data: {
        organizationId,
        year: 2026,
        month: 1,
        revenueSource: 'ENTRIES',
      },
    });

    await prisma.financialEntry.createMany({
      data: [
        {
          organizationId,
          periodId: period.id,
          categoryId: revenueCategoryId,
          description: 'Receita reconhecida',
          amount: '5000.00',
          dueDate: new Date('2026-01-10T00:00:00.000Z'),
          status: 'PENDING',
        },
        {
          organizationId,
          periodId: period.id,
          categoryId: fixedCategoryId,
          description: 'Custo fixo',
          amount: '1200.00',
          dueDate: new Date('2026-01-12T00:00:00.000Z'),
          status: 'SETTLED',
        },
        {
          organizationId,
          periodId: period.id,
          categoryId: variableCategoryId,
          description: 'Custo variável',
          amount: '800.00',
          dueDate: new Date('2026-01-14T00:00:00.000Z'),
          status: 'PARTIAL',
        },
        {
          organizationId,
          periodId: period.id,
          categoryId: revenueCategoryId,
          description: 'Receita cancelada',
          amount: '9999.99',
          dueDate: new Date('2026-01-16T00:00:00.000Z'),
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      ],
    });

    const response = await request(app.getHttpServer())
      .get(`/api/finance/periods/${period.id}/summary`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(response.body).toEqual({
      period: {
        id: period.id,
        year: 2026,
        month: 1,
        status: 'OPEN',
        revenueSource: 'ENTRIES',
        manualRevenue: null,
      },
      totals: {
        revenue: '5000.00',
        fixedExpenses: '1200.00',
        variableExpenses: '800.00',
        contributionMargin: '4200.00',
        result: '3000.00',
        resultStatus: 'POSITIVE',
      },
      entryCounts: {
        revenue: 1,
        fixedExpenses: 1,
        variableExpenses: 1,
        total: 3,
      },
    });
  });

  it('GET should use only manual revenue and calculate a negative result', async () => {
    const period = await prisma.financialPeriod.create({
      data: {
        organizationId,
        year: 2026,
        month: 2,
        revenueSource: 'MANUAL_TOTAL',
        manualRevenue: '1000.00',
      },
    });

    await prisma.financialEntry.createMany({
      data: [
        {
          organizationId,
          periodId: period.id,
          categoryId: fixedCategoryId,
          description: 'Custo fixo manual',
          amount: '800.00',
          dueDate: new Date('2026-02-10T00:00:00.000Z'),
        },
        {
          organizationId,
          periodId: period.id,
          categoryId: variableCategoryId,
          description: 'Custo variável manual',
          amount: '500.00',
          dueDate: new Date('2026-02-12T00:00:00.000Z'),
        },
        {
          organizationId,
          periodId: period.id,
          categoryId: revenueCategoryId,
          description: 'Receita que não pode ser somada',
          amount: '9000.00',
          dueDate: new Date('2026-02-14T00:00:00.000Z'),
        },
      ],
    });

    const response = await request(app.getHttpServer())
      .get(`/api/finance/periods/${period.id}/summary`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(response.body.period).toMatchObject({
      revenueSource: 'MANUAL_TOTAL',
      manualRevenue: '1000.00',
    });

    expect(response.body.totals).toEqual({
      revenue: '1000.00',
      fixedExpenses: '800.00',
      variableExpenses: '500.00',
      contributionMargin: '500.00',
      result: '-300.00',
      resultStatus: 'NEGATIVE',
    });

    expect(response.body.entryCounts).toEqual({
      revenue: 0,
      fixedExpenses: 1,
      variableExpenses: 1,
      total: 2,
    });
  });

  it('GET should classify a zero result as neutral', async () => {
    const period = await prisma.financialPeriod.create({
      data: {
        organizationId,
        year: 2026,
        month: 3,
        revenueSource: 'MANUAL_TOTAL',
        manualRevenue: '300.00',
      },
    });

    await prisma.financialEntry.createMany({
      data: [
        {
          organizationId,
          periodId: period.id,
          categoryId: fixedCategoryId,
          description: 'Custo fixo neutro',
          amount: '100.00',
          dueDate: new Date('2026-03-10T00:00:00.000Z'),
        },
        {
          organizationId,
          periodId: period.id,
          categoryId: variableCategoryId,
          description: 'Custo variável neutro',
          amount: '200.00',
          dueDate: new Date('2026-03-12T00:00:00.000Z'),
        },
      ],
    });

    const response = await request(app.getHttpServer())
      .get(`/api/finance/periods/${period.id}/summary`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(response.body.totals).toMatchObject({
      revenue: '300.00',
      contributionMargin: '100.00',
      result: '0.00',
      resultStatus: 'NEUTRAL',
    });
  });

  it('GET should return zero totals for an empty period', async () => {
    const period = await prisma.financialPeriod.create({
      data: {
        organizationId,
        year: 2026,
        month: 4,
        revenueSource: 'ENTRIES',
      },
    });

    const response = await request(app.getHttpServer())
      .get(`/api/finance/periods/${period.id}/summary`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(response.body.totals).toEqual({
      revenue: '0.00',
      fixedExpenses: '0.00',
      variableExpenses: '0.00',
      contributionMargin: '0.00',
      result: '0.00',
      resultStatus: 'NEUTRAL',
    });

    expect(response.body.entryCounts).toEqual({
      revenue: 0,
      fixedExpenses: 0,
      variableExpenses: 0,
      total: 0,
    });
  });

  it('GET should not expose another organization period', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/finance/periods/${otherPeriodId}/summary`)
      .set('Cookie', sessionCookie)
      .expect(404);

    expect(response.body.message).toBe(
      'Competência financeira não encontrada.',
    );
  });

  it('GET should reject an invalid period identifier', async () => {
    await request(app.getHttpServer())
      .get('/api/finance/periods/invalid-id/summary')
      .set('Cookie', sessionCookie)
      .expect(400);
  });

  it('GET should reject an unauthenticated request', async () => {
    const period = await prisma.financialPeriod.create({
      data: {
        organizationId,
        year: 2026,
        month: 5,
        revenueSource: 'ENTRIES',
      },
    });

    await request(app.getHttpServer())
      .get(`/api/finance/periods/${period.id}/summary`)
      .expect(401);
  });

  afterAll(async () => {
    // Active sessions reference membership; remove only this fixture's sessions first.
    if (userId) {
      await prisma.session.deleteMany({ where: { userId } });
    }

    if (organizationId && otherOrganizationId) {
      await prisma.auditLog.deleteMany({
        where: {
          organizationId: {
            in: [organizationId, otherOrganizationId],
          },
        },
      });

      await prisma.organization.deleteMany({
        where: {
          id: {
            in: [organizationId, otherOrganizationId],
          },
        },
      });
    }

    if (userId) {
      await prisma.user.delete({
        where: {
          id: userId,
        },
      });
    }

    await app.close();
  });
});
