import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/database/prisma.service.js';

describe('Financial periods (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let sessionCookie: string;
  let userId: string;
  let organizationId: string;
  let otherOrganizationId: string | undefined;

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
        name: 'Competências E2E',
        email: `periods.${randomUUID()}@example.com`,
        password: 'senha-e2e-segura',
        organizationName: 'Empresa Competências E2E',
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
  });

  it('POST /api/finance/periods should create an entries-based period', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/finance/periods')
      .set('Cookie', sessionCookie)
      .send({
        year: 2026,
        month: 9,
        revenueSource: 'ENTRIES',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      year: 2026,
      month: 9,
      status: 'OPEN',
      revenueSource: 'ENTRIES',
      manualRevenue: null,
      closedAt: null,
    });

    const persistedPeriod = await prisma.financialPeriod.findUniqueOrThrow({
      where: {
        organizationId_year_month: {
          organizationId,
          year: 2026,
          month: 9,
        },
      },
    });

    expect(persistedPeriod.id).toBe(response.body.id);
    expect(persistedPeriod.manualRevenue).toBeNull();

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        action: 'financial_period.created',
        entityId: response.body.id,
      },
    });

    expect(auditLog.entityType).toBe('financial_period');
    expect(auditLog.metadata).toEqual({
      year: 2026,
      month: 9,
      revenueSource: 'ENTRIES',
      manualRevenue: null,
    });
  });

  it('POST /api/finance/periods should create a manual-revenue period', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/finance/periods')
      .set('Cookie', sessionCookie)
      .send({
        year: 2026,
        month: 8,
        revenueSource: 'MANUAL_TOTAL',
        manualRevenue: '8500.5',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      year: 2026,
      month: 8,
      status: 'OPEN',
      revenueSource: 'MANUAL_TOTAL',
      manualRevenue: '8500.50',
      closedAt: null,
    });
  });

  it('POST /api/finance/periods should require revenue for a manual period', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/finance/periods')
      .set('Cookie', sessionCookie)
      .send({
        year: 2026,
        month: 7,
        revenueSource: 'MANUAL_TOTAL',
      })
      .expect(400);

    expect(response.body.message).toBe(
      'Informe a receita manual para esta competência.',
    );
  });

  it('POST /api/finance/periods should reject manual revenue for an entries-based period', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/finance/periods')
      .set('Cookie', sessionCookie)
      .send({
        year: 2026,
        month: 7,
        revenueSource: 'ENTRIES',
        manualRevenue: '1000.00',
      })
      .expect(400);

    expect(response.body.message).toBe(
      'A receita manual não pode ser informada quando a receita vem dos lançamentos.',
    );
  });

  it('POST /api/finance/periods should reject a duplicated month', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/finance/periods')
      .set('Cookie', sessionCookie)
      .send({
        year: 2026,
        month: 9,
        revenueSource: 'ENTRIES',
      })
      .expect(409);

    expect(response.body.message).toBe(
      'Já existe uma competência financeira para este mês.',
    );
  });

  it('GET /api/finance/periods should filter and isolate periods', async () => {
    const otherOrganization = await prisma.organization.create({
      data: {
        name: 'Outra Empresa Competências',
        slug: `outra-competencias-${randomUUID()}`,
      },
    });

    otherOrganizationId = otherOrganization.id;

    await prisma.financialPeriod.create({
      data: {
        organizationId: otherOrganization.id,
        year: 2026,
        month: 8,
        revenueSource: 'MANUAL_TOTAL',
        manualRevenue: '99999.99',
      },
    });

    const response = await request(app.getHttpServer())
      .get('/api/finance/periods')
      .query({
        year: 2026,
        status: 'OPEN',
        revenueSource: 'MANUAL_TOTAL',
      })
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      year: 2026,
      month: 8,
      revenueSource: 'MANUAL_TOTAL',
      manualRevenue: '8500.50',
    });

    expect(
      response.body.some(
        (period: { manualRevenue: string | null }) =>
          period.manualRevenue === '99999.99',
      ),
    ).toBe(false);
  });

  it('POST /api/finance/periods should reject invalid and additional fields', async () => {
    await request(app.getHttpServer())
      .post('/api/finance/periods')
      .set('Cookie', sessionCookie)
      .send({
        year: 2026,
        month: 13,
        revenueSource: 'MANUAL_TOTAL',
        manualRevenue: '-1.00',
        organizationId: randomUUID(),
      })
      .expect(400);
  });

  it('should reject an unauthenticated request', async () => {
    await request(app.getHttpServer()).get('/api/finance/periods').expect(401);
  });

  afterAll(async () => {
    // Active sessions reference membership; remove only this fixture's sessions first.
    if (userId) {
      await prisma.session.deleteMany({ where: { userId } });
    }

    if (otherOrganizationId) {
      await prisma.organization.delete({
        where: {
          id: otherOrganizationId,
        },
      });
    }

    if (organizationId && userId) {
      await prisma.$transaction([
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
