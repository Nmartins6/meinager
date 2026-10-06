import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SessionService } from '../src/auth/session/session.service.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { OrganizationRole } from '../src/generated/prisma/enums.js';

interface TestIdentity {
  cookie: string;
  organizationId: string;
  userId: string;
}

describe('Pricing configuration (e2e)', () => {
  let app: NestExpressApplication | undefined;
  let prisma: PrismaService;
  let primary: TestIdentity;
  let concurrent: TestIdentity;
  let noConfiguration: TestIdentity;
  let secondaryActor: TestIdentity;

  function httpServer() {
    if (!app) throw new Error('Test application was not initialized');
    return app.getHttpServer();
  }

  async function register(label: string): Promise<TestIdentity> {
    const suffix = randomUUID();
    const response = await request(httpServer())
      .post('/api/auth/register')
      .send({
        name: `Pricing ${label}`,
        email: `pricing.${label}.${suffix}@example.com`,
        password: 'senha-e2e-segura',
        organizationName: `Pricing ${label} ${suffix}`,
      })
      .expect(201);

    const cookieHeader = response.headers['set-cookie'];
    const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
    if (!cookie) throw new Error('Session cookie was not returned');

    return {
      cookie: cookie.split(';', 1)[0]!,
      organizationId: response.body.organization.id,
      userId: response.body.user.id,
    };
  }

  function validConfiguration(expectedRevision: number | null) {
    return {
      expectedRevision,
      currency: 'BRL',
      fixedCostMode: 'RATE',
      fixedCostRate: '0.12345678',
      monthlyLaborCost: '1234567890123.123456',
      productiveHours: '160.125',
      defaultDesiredMargin: '0.25',
      parameterOrigins: {
        fixedCostMode: { origin: 'MANUAL' },
        fixedCostRate: { origin: 'MANUAL' },
        monthlyLaborCost: { origin: 'MANUAL' },
        productiveHours: { origin: 'MANUAL' },
        defaultDesiredMargin: { origin: 'MANUAL' },
      },
    };
  }

  async function currentRevision(identity = primary): Promise<number> {
    const response = await request(httpServer())
      .get('/api/pricing/configuration')
      .set('Cookie', identity.cookie)
      .expect(200);
    return response.body.currentRevision.revision;
  }

  function assertDisposableDatabase(): void {
    const databaseUrl = process.env.DATABASE_URL;
    const expectedDatabase = process.env.PRICING_CONFIGURATION_E2E_DATABASE;
    const normalDatabase =
      process.env.PRICING_CONFIGURATION_E2E_NORMAL_DATABASE;

    if (
      process.env.PRICING_CONFIGURATION_E2E_DISPOSABLE !== 'YES' ||
      !databaseUrl ||
      !expectedDatabase ||
      !normalDatabase
    ) {
      throw new Error(
        'Pricing configuration E2E requires its disposable PostgreSQL runner.',
      );
    }

    const resolvedDatabase = new URL(databaseUrl).pathname.slice(1);
    if (
      resolvedDatabase !== expectedDatabase ||
      resolvedDatabase === normalDatabase ||
      !/^pricing_configuration_e2e_[a-f0-9]{16}$/.test(resolvedDatabase)
    ) {
      throw new Error(
        `Refusing non-disposable pricing configuration database: ${resolvedDatabase}`,
      );
    }
  }

  beforeAll(async () => {
    assertDisposableDatabase();
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    primary = await register('primary');
    concurrent = await register('concurrent');
    noConfiguration = await register('empty');

    const secondaryEmail = `pricing.secondary.${randomUUID()}@example.com`;
    const secondaryUser = await prisma.user.create({
      data: {
        name: 'Pricing secondary actor',
        email: secondaryEmail,
        normalizedEmail: secondaryEmail,
        passwordHash: 'test-only',
        memberships: {
          create: {
            organizationId: primary.organizationId,
            role: OrganizationRole.ADMIN,
          },
        },
      },
    });
    const secondarySession = await app
      .get(SessionService)
      .create(secondaryUser.id);
    secondaryActor = {
      cookie: `meinager_session=${secondarySession.token}`,
      organizationId: primary.organizationId,
      userId: secondaryUser.id,
    };
  });

  it('requires authentication and returns the stable not-found contract', async () => {
    const unauthenticated = await request(httpServer())
      .get('/api/pricing/configuration')
      .expect(401);
    expect(unauthenticated.body).toMatchObject({
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
    });

    const unauthenticatedPatch = await request(httpServer())
      .patch('/api/pricing/configuration')
      .send(validConfiguration(null))
      .expect(401);
    expect(unauthenticatedPatch.body.code).toBe('AUTHENTICATION_REQUIRED');

    const missing = await request(httpServer())
      .get('/api/pricing/configuration')
      .set('Cookie', primary.cookie)
      .expect(404);
    expect(missing.body).toEqual({
      statusCode: 404,
      code: 'PRICING_CONFIGURATION_NOT_FOUND',
      message: 'Configuração de precificação não encontrada.',
    });
  });

  it('rejects protected and unknown fields without changing state', async () => {
    for (const field of [
      { organizationId: concurrent.organizationId },
      { actorUserId: concurrent.userId },
      { effectiveFrom: new Date().toISOString() },
      { revision: 9 },
      { unknownField: true },
    ]) {
      const response = await request(httpServer())
        .patch('/api/pricing/configuration')
        .set('Cookie', primary.cookie)
        .send({ ...validConfiguration(null), ...field })
        .expect(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    }

    const clientConfirmedBy = await request(httpServer())
      .patch('/api/pricing/configuration')
      .set('Cookie', primary.cookie)
      .send({
        ...validConfiguration(null),
        parameterOrigins: {
          ...validConfiguration(null).parameterOrigins,
          fixedCostRate: {
            origin: 'MANUAL',
            confirmedByUserId: concurrent.userId,
          },
        },
      })
      .expect(400);
    expect(clientConfirmedBy.body.code).toBe('VALIDATION_ERROR');

    expect(
      await prisma.organizationPricingConfiguration.count({
        where: { organizationId: primary.organizationId },
      }),
    ).toBe(0);
  });

  it('validates decimal syntax, sign, precision, currency and conditional states', async () => {
    const invalidDecimals: Array<[unknown, string]> = [
      [1.25, 'INVALID_DECIMAL_VALUE'],
      ['1e-2', 'INVALID_DECIMAL_VALUE'],
      ['NaN', 'INVALID_DECIMAL_VALUE'],
      ['Infinity', 'INVALID_DECIMAL_VALUE'],
      ['+1.5', 'INVALID_DECIMAL_VALUE'],
      ['0.123456789', 'INVALID_DECIMAL_VALUE'],
      ['10000.00000000', 'INVALID_DECIMAL_VALUE'],
      ['-0.1', 'NEGATIVE_VALUE'],
    ];

    for (const [fixedCostRate, code] of invalidDecimals) {
      const response = await request(httpServer())
        .patch('/api/pricing/configuration')
        .set('Cookie', primary.cookie)
        .send({ ...validConfiguration(null), fixedCostRate })
        .expect(400);
      expect(response.body).toMatchObject({ code, field: 'fixedCostRate' });
    }

    const currency = await request(httpServer())
      .patch('/api/pricing/configuration')
      .set('Cookie', primary.cookie)
      .send({ ...validConfiguration(null), currency: 'USD' })
      .expect(400);
    expect(currency.body).toMatchObject({
      code: 'UNSUPPORTED_CURRENCY',
      field: 'currency',
    });

    const fixedCosts = await request(httpServer())
      .patch('/api/pricing/configuration')
      .set('Cookie', primary.cookie)
      .send({
        ...validConfiguration(null),
        fixedCostMode: 'MONTHLY',
        fixedCostRate: null,
        monthlyFixedCost: '1000',
        averageMonthlyRevenue: '0',
      })
      .expect(400);
    expect(fixedCosts.body.code).toBe('INVALID_AVERAGE_REVENUE');

    const labor = await request(httpServer())
      .patch('/api/pricing/configuration')
      .set('Cookie', primary.cookie)
      .send({
        ...validConfiguration(null),
        productiveHours: null,
      })
      .expect(400);
    expect(labor.body.code).toBe('VALIDATION_ERROR');
  });

  it('creates root and first revision atomically with backend provenance', async () => {
    const before = new Date();
    const response = await request(httpServer())
      .patch('/api/pricing/configuration')
      .set('Cookie', primary.cookie)
      .send(validConfiguration(null))
      .expect(200);
    const after = new Date();

    expect(response.body).toMatchObject({
      isActive: true,
      currentRevision: {
        revision: 1,
        currency: 'BRL',
        fixedCostMode: 'RATE',
        fixedCostRate: '0.12345678',
        monthlyFixedCost: null,
        averageMonthlyRevenue: null,
        monthlyLaborCost: '1234567890123.123456',
        productiveHours: '160.125',
        defaultDesiredMargin: '0.25',
      },
    });
    expect(typeof response.body.currentRevision.fixedCostRate).toBe('string');

    const effectiveFrom = new Date(response.body.currentRevision.effectiveFrom);
    expect(effectiveFrom.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(effectiveFrom.getTime()).toBeLessThanOrEqual(after.getTime());
    expect(
      response.body.currentRevision.parameterOrigins.fixedCostRate
        .confirmedByUserId,
    ).toBe(primary.userId);

    const audit = await prisma.auditLog.findMany({
      where: {
        organizationId: primary.organizationId,
        action: 'pricing_configuration.updated',
      },
    });
    expect(audit).toHaveLength(1);
    expect(audit[0]?.actorUserId).toBe(primary.userId);
    expect(audit[0]?.metadata).toMatchObject({
      operation: 'CREATE',
      previousRevision: null,
      newRevision: 1,
    });
    expect(JSON.stringify(audit[0]?.metadata)).not.toContain('0.12345678');
  });

  it('rejects non-null expectedRevision for initial creation without audit', async () => {
    const response = await request(httpServer())
      .patch('/api/pricing/configuration')
      .set('Cookie', noConfiguration.cookie)
      .send({ expectedRevision: 1, defaultDesiredMargin: '0.2' })
      .expect(409);

    expect(response.body).toMatchObject({
      code: 'PRICING_REVISION_CONFLICT',
      details: { expectedRevision: 1, currentRevision: null },
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /P20\d\d|SQL|constraint/i,
    );
    expect(
      await prisma.auditLog.count({
        where: {
          organizationId: noConfiguration.organizationId,
          action: 'pricing_configuration.updated',
        },
      }),
    ).toBe(0);
  });

  it('updates by immutable revision and preserves the previous revision', async () => {
    const first =
      await prisma.organizationPricingConfiguration.findUniqueOrThrow({
        where: { organizationId: primary.organizationId },
        include: { currentRevision: true },
      });

    const response = await request(httpServer())
      .patch('/api/pricing/configuration')
      .set('Cookie', primary.cookie)
      .send({
        expectedRevision: 1,
        defaultDesiredMargin: '0.33333333',
        parameterOrigins: { defaultDesiredMargin: { origin: 'MANUAL' } },
      })
      .expect(200);

    expect(response.body.currentRevision).toMatchObject({
      revision: 2,
      fixedCostRate: '0.12345678',
      defaultDesiredMargin: '0.33333333',
    });
    expect(response.body.currentRevision.id).not.toBe(first.currentRevisionId);

    const oldRevision =
      await prisma.organizationPricingConfigurationRevision.findUniqueOrThrow({
        where: { id: first.currentRevisionId! },
      });
    expect(oldRevision.revision).toBe(1);
    expect(oldRevision.defaultDesiredMargin?.toString()).toBe('0.25');
  });

  it('rejects stale revisions and rolls back without an audit', async () => {
    const auditsBefore = await prisma.auditLog.count({
      where: {
        organizationId: primary.organizationId,
        action: 'pricing_configuration.updated',
      },
    });
    const response = await request(httpServer())
      .patch('/api/pricing/configuration')
      .set('Cookie', primary.cookie)
      .send({ expectedRevision: 1, defaultDesiredMargin: '0.4' })
      .expect(409);

    expect(response.body).toMatchObject({
      code: 'PRICING_REVISION_CONFLICT',
      details: { expectedRevision: 1, currentRevision: 2 },
    });
    expect(
      await prisma.auditLog.count({
        where: {
          organizationId: primary.organizationId,
          action: 'pricing_configuration.updated',
        },
      }),
    ).toBe(auditsBefore);
  });

  it('requires provenance for changed values and rejects incompatible origins', async () => {
    const revision = await currentRevision();
    const revisionsBefore =
      await prisma.organizationPricingConfigurationRevision.count({
        where: { organizationId: primary.organizationId },
      });

    const missing = await request(httpServer())
      .patch('/api/pricing/configuration')
      .set('Cookie', primary.cookie)
      .send({ expectedRevision: revision, fixedCostRate: '0.2' })
      .expect(400);
    expect(missing.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      field: 'parameterOrigins.fixedCostRate',
    });

    const incompatible = await request(httpServer())
      .patch('/api/pricing/configuration')
      .set('Cookie', primary.cookie)
      .send({
        expectedRevision: revision,
        parameterOrigins: { monthlyFixedCost: { origin: 'MANUAL' } },
      })
      .expect(400);
    expect(incompatible.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      field: 'parameterOrigins.monthlyFixedCost',
    });

    expect(
      await prisma.organizationPricingConfigurationRevision.count({
        where: { organizationId: primary.organizationId },
      }),
    ).toBe(revisionsBefore);
  });

  it('merges origins partially and confirms changed values with the current actor', async () => {
    const before = await request(httpServer())
      .get('/api/pricing/configuration')
      .set('Cookie', primary.cookie)
      .expect(200);
    const previousMarginOrigin =
      before.body.currentRevision.parameterOrigins.defaultDesiredMargin;

    const response = await request(httpServer())
      .patch('/api/pricing/configuration')
      .set('Cookie', secondaryActor.cookie)
      .send({
        expectedRevision: before.body.currentRevision.revision,
        fixedCostRate: '0.2',
        parameterOrigins: {
          fixedCostRate: {
            origin: 'COPIED',
            source: 'configuration-review',
          },
        },
      })
      .expect(200);

    const origins = response.body.currentRevision.parameterOrigins;
    expect(origins.fixedCostRate).toMatchObject({
      origin: 'COPIED',
      source: 'configuration-review',
      confirmedByUserId: secondaryActor.userId,
    });
    expect(origins.defaultDesiredMargin).toEqual(previousMarginOrigin);
    expect(origins.defaultDesiredMargin.confirmedByUserId).toBe(primary.userId);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId: primary.organizationId,
        action: 'pricing_configuration.updated',
        actorUserId: secondaryActor.userId,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit.metadata).toMatchObject({
      changedFields: ['fixedCostRate', 'parameterOrigins'],
    });
  });

  it('removes origins for null values and both sides of fixed-cost mode changes', async () => {
    let revision = await currentRevision();
    const withoutLabor = await request(httpServer())
      .patch('/api/pricing/configuration')
      .set('Cookie', primary.cookie)
      .send({
        expectedRevision: revision,
        monthlyLaborCost: null,
        productiveHours: null,
      })
      .expect(200);
    expect(
      withoutLabor.body.currentRevision.parameterOrigins,
    ).not.toHaveProperty('monthlyLaborCost');
    expect(
      withoutLabor.body.currentRevision.parameterOrigins,
    ).not.toHaveProperty('productiveHours');

    revision = withoutLabor.body.currentRevision.revision;
    const monthly = await request(httpServer())
      .patch('/api/pricing/configuration')
      .set('Cookie', primary.cookie)
      .send({
        expectedRevision: revision,
        fixedCostMode: 'MONTHLY',
        monthlyFixedCost: '1000',
        averageMonthlyRevenue: '5000',
        parameterOrigins: {
          fixedCostMode: { origin: 'MANUAL' },
          monthlyFixedCost: { origin: 'MANUAL' },
          averageMonthlyRevenue: {
            origin: 'MANUAL',
            periodStart: '2026-09-01T00:00:00.000Z',
            periodEnd: '2026-09-30T23:59:59.999Z',
          },
        },
      })
      .expect(200);
    expect(monthly.body.currentRevision.fixedCostRate).toBeNull();
    expect(monthly.body.currentRevision.parameterOrigins).not.toHaveProperty(
      'fixedCostRate',
    );

    const rate = await request(httpServer())
      .patch('/api/pricing/configuration')
      .set('Cookie', primary.cookie)
      .send({
        expectedRevision: monthly.body.currentRevision.revision,
        fixedCostMode: 'RATE',
        fixedCostRate: '0.15',
        parameterOrigins: {
          fixedCostMode: { origin: 'MANUAL' },
          fixedCostRate: { origin: 'MANUAL' },
        },
      })
      .expect(200);
    expect(rate.body.currentRevision.monthlyFixedCost).toBeNull();
    expect(rate.body.currentRevision.averageMonthlyRevenue).toBeNull();
    expect(rate.body.currentRevision.parameterOrigins).not.toHaveProperty(
      'monthlyFixedCost',
    );
    expect(rate.body.currentRevision.parameterOrigins).not.toHaveProperty(
      'averageMonthlyRevenue',
    );
  });

  it('returns no-op updates without creating revision or audit', async () => {
    const before = await request(httpServer())
      .get('/api/pricing/configuration')
      .set('Cookie', primary.cookie)
      .expect(200);
    const revisionsBefore =
      await prisma.organizationPricingConfigurationRevision.count({
        where: { organizationId: primary.organizationId },
      });
    const auditsBefore = await prisma.auditLog.count({
      where: {
        organizationId: primary.organizationId,
        action: 'pricing_configuration.updated',
      },
    });

    const equivalent = await request(httpServer())
      .patch('/api/pricing/configuration')
      .set('Cookie', primary.cookie)
      .send({
        expectedRevision: before.body.currentRevision.revision,
        fixedCostRate: '0.15000000',
      })
      .expect(200);
    const identical = await request(httpServer())
      .patch('/api/pricing/configuration')
      .set('Cookie', primary.cookie)
      .send({ expectedRevision: before.body.currentRevision.revision })
      .expect(200);

    expect(equivalent.body.currentRevision.id).toBe(
      before.body.currentRevision.id,
    );
    expect(identical.body.currentRevision.id).toBe(
      before.body.currentRevision.id,
    );
    expect(
      await prisma.organizationPricingConfigurationRevision.count({
        where: { organizationId: primary.organizationId },
      }),
    ).toBe(revisionsBefore);
    expect(
      await prisma.auditLog.count({
        where: {
          organizationId: primary.organizationId,
          action: 'pricing_configuration.updated',
        },
      }),
    ).toBe(auditsBefore);

    const stale = await request(httpServer())
      .patch('/api/pricing/configuration')
      .set('Cookie', primary.cookie)
      .send({ expectedRevision: before.body.currentRevision.revision - 1 })
      .expect(409);
    expect(stale.body.code).toBe('PRICING_REVISION_CONFLICT');
  });

  it('serializes concurrent initial creation so exactly one request wins', async () => {
    const responses = await Promise.all([
      request(httpServer())
        .patch('/api/pricing/configuration')
        .set('Cookie', concurrent.cookie)
        .send(validConfiguration(null)),
      request(httpServer())
        .patch('/api/pricing/configuration')
        .set('Cookie', concurrent.cookie)
        .send(validConfiguration(null)),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(
      responses.find((response) => response.status === 409)?.body.code,
    ).toBe('PRICING_REVISION_CONFLICT');
    expect(
      await prisma.organizationPricingConfigurationRevision.count({
        where: { organizationId: concurrent.organizationId },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: {
          organizationId: concurrent.organizationId,
          action: 'pricing_configuration.updated',
        },
      }),
    ).toBe(1);
  });

  it('serializes concurrent updates so one revision and one audit win', async () => {
    const expectedRevision = await currentRevision();
    const auditsBefore = await prisma.auditLog.count({
      where: {
        organizationId: primary.organizationId,
        action: 'pricing_configuration.updated',
      },
    });
    const responses = await Promise.all([
      request(httpServer())
        .patch('/api/pricing/configuration')
        .set('Cookie', primary.cookie)
        .send({
          expectedRevision,
          defaultDesiredMargin: '0.41',
          parameterOrigins: { defaultDesiredMargin: { origin: 'MANUAL' } },
        }),
      request(httpServer())
        .patch('/api/pricing/configuration')
        .set('Cookie', primary.cookie)
        .send({
          expectedRevision,
          defaultDesiredMargin: '0.42',
          parameterOrigins: { defaultDesiredMargin: { origin: 'MANUAL' } },
        }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(
      responses.find((response) => response.status === 409)?.body.code,
    ).toBe('PRICING_REVISION_CONFLICT');
    expect(await currentRevision()).toBe(expectedRevision + 1);
    expect(
      await prisma.auditLog.count({
        where: {
          organizationId: primary.organizationId,
          action: 'pricing_configuration.updated',
        },
      }),
    ).toBe(auditsBefore + 1);
  });

  it('enforces the complete role matrix for GET and PATCH', async () => {
    const membershipWhere = {
      organizationId_userId: {
        organizationId: primary.organizationId,
        userId: primary.userId,
      },
    };

    try {
      for (const role of Object.values(OrganizationRole)) {
        await prisma.organizationMember.update({
          where: membershipWhere,
          data: { role },
        });

        const get = await request(httpServer())
          .get('/api/pricing/configuration')
          .set('Cookie', primary.cookie);
        expect(get.status).toBe(role === OrganizationRole.VIEWER ? 403 : 200);
        if (get.status === 403) expect(get.body.code).toBe('PRICING_FORBIDDEN');

        const revision =
          get.status === 200
            ? get.body.currentRevision.revision
            : await prisma.organizationPricingConfiguration
                .findUniqueOrThrow({
                  where: { organizationId: primary.organizationId },
                  include: { currentRevision: true },
                })
                .then((value) => value.currentRevision!.revision);
        const patch = await request(httpServer())
          .patch('/api/pricing/configuration')
          .set('Cookie', primary.cookie)
          .send({
            expectedRevision: revision,
            defaultDesiredMargin:
              role === OrganizationRole.OWNER ? '0.51' : '0.52',
            parameterOrigins: {
              defaultDesiredMargin: { origin: 'MANUAL' },
            },
          });
        const canWrite =
          role === OrganizationRole.OWNER || role === OrganizationRole.ADMIN;
        expect(patch.status).toBe(canWrite ? 200 : 403);
        if (!canWrite) expect(patch.body.code).toBe('PRICING_FORBIDDEN');
      }
    } finally {
      await prisma.organizationMember.update({
        where: membershipWhere,
        data: { role: OrganizationRole.OWNER },
      });
    }
  });

  it('isolates organizations and returns only each current configuration', async () => {
    const primaryResponse = await request(httpServer())
      .get('/api/pricing/configuration')
      .set('Cookie', primary.cookie)
      .expect(200);
    const concurrentResponse = await request(httpServer())
      .get('/api/pricing/configuration')
      .set('Cookie', concurrent.cookie)
      .expect(200);

    expect(primaryResponse.body.id).not.toBe(concurrentResponse.body.id);
    expect(primaryResponse.body.currentRevision.revision).toBeGreaterThan(1);
    expect(concurrentResponse.body.currentRevision.revision).toBe(1);
  });

  it('has exactly one audit event for every committed revision', async () => {
    for (const identity of [primary, concurrent]) {
      const [revisions, audits] = await Promise.all([
        prisma.organizationPricingConfigurationRevision.count({
          where: { organizationId: identity.organizationId },
        }),
        prisma.auditLog.count({
          where: {
            organizationId: identity.organizationId,
            action: 'pricing_configuration.updated',
          },
        }),
      ]);
      expect(audits).toBe(revisions);
    }
  });

  afterAll(async () => {
    await app?.close();
  });
});
