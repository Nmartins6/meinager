import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/database/prisma.service.js';

describe('Financial accounts (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let sessionCookie: string;
  let userId: string;
  let organizationId: string;
  let otherOrganizationId: string | undefined;
  let checkingAccountId: string;
  let cashAccountId: string;
  let otherAccountId: string | undefined;

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
        name: 'Contas Financeiras E2E',
        email: `accounts.${randomUUID()}@example.com`,
        password: 'senha-e2e-segura',
        organizationName: 'Empresa Contas E2E',
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

  it('POST /api/finance/accounts should create an account', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/finance/accounts')
      .set('Cookie', sessionCookie)
      .send({
        name: '  Conta principal  ',
        type: 'CHECKING_ACCOUNT',
        openingBalance: '1250.50',
      })
      .expect(201);

    checkingAccountId = response.body.id;

    expect(response.body).toMatchObject({
      name: 'Conta principal',
      type: 'CHECKING_ACCOUNT',
      openingBalance: '1250.50',
      isActive: true,
    });

    const persistedAccount = await prisma.financialAccount.findUniqueOrThrow({
      where: {
        id: response.body.id,
      },
    });

    expect(persistedAccount.organizationId).toBe(organizationId);
    expect(persistedAccount.normalizedName).toBe('conta principal');
    expect(persistedAccount.openingBalance.toFixed(2)).toBe('1250.50');

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        action: 'financial_account.created',
        entityId: response.body.id,
      },
    });

    expect(auditLog.entityType).toBe('financial_account');
    expect(auditLog.metadata).toEqual({
      openingBalance: '1250.50',
    });
  });

  it('POST /api/finance/accounts should use zero as the default opening balance', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/finance/accounts')
      .set('Cookie', sessionCookie)
      .send({
        name: 'Caixa físico',
        type: 'CASH',
      })
      .expect(201);

    cashAccountId = response.body.id;

    expect(response.body).toMatchObject({
      name: 'Caixa físico',
      type: 'CASH',
      openingBalance: '0.00',
      isActive: true,
    });
  });

  it('POST /api/finance/accounts should reject a duplicated normalized name', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/finance/accounts')
      .set('Cookie', sessionCookie)
      .send({
        name: 'CONTA PRINCIPAL',
        type: 'SAVINGS_ACCOUNT',
        openingBalance: '0',
      })
      .expect(409);

    expect(response.body.message).toBe(
      'Já existe uma conta financeira com este nome.',
    );
  });

  it('GET /api/finance/accounts should filter and isolate accounts', async () => {
    const otherOrganization = await prisma.organization.create({
      data: {
        name: 'Outra Empresa Contas',
        slug: `outra-contas-${randomUUID()}`,
      },
    });

    otherOrganizationId = otherOrganization.id;

    const otherAccount = await prisma.financialAccount.create({
      data: {
        organizationId: otherOrganization.id,
        name: 'Conta externa',
        normalizedName: 'conta externa',
        type: 'CHECKING_ACCOUNT',
        openingBalance: '999.99',
      },
    });

    otherAccountId = otherAccount.id;

    const response = await request(app.getHttpServer())
      .get('/api/finance/accounts')
      .query({
        type: 'CHECKING_ACCOUNT',
        isActive: true,
      })
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      name: 'Conta principal',
      type: 'CHECKING_ACCOUNT',
      openingBalance: '1250.50',
    });

    expect(
      response.body.some(
        (account: { name: string }) => account.name === 'Conta externa',
      ),
    ).toBe(false);
  });

  it('PATCH /api/finance/accounts/:id should update and deactivate an account before movements', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/finance/accounts/${checkingAccountId}`)
      .set('Cookie', sessionCookie)
      .send({
        name: '  Conta operacional  ',
        openingBalance: '1500.25',
        isActive: false,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: checkingAccountId,
      name: 'Conta operacional',
      type: 'CHECKING_ACCOUNT',
      openingBalance: '1500.25',
      isActive: false,
    });

    const persistedAccount = await prisma.financialAccount.findUniqueOrThrow({
      where: {
        id: checkingAccountId,
      },
    });

    expect(persistedAccount.normalizedName).toBe('conta operacional');
    expect(persistedAccount.openingBalance.toFixed(2)).toBe('1500.25');
    expect(persistedAccount.isActive).toBe(false);

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        action: 'financial_account.updated',
        entityId: checkingAccountId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    expect(auditLog.metadata).toEqual({
      previous: {
        name: 'Conta principal',
        openingBalance: '1250.50',
        isActive: true,
      },
      current: {
        name: 'Conta operacional',
        openingBalance: '1500.25',
        isActive: false,
      },
    });
  });

  it('PATCH /api/finance/accounts/:id should reject an empty payload', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/finance/accounts/${checkingAccountId}`)
      .set('Cookie', sessionCookie)
      .send({})
      .expect(400);

    expect(response.body.message).toBe(
      'Informe ao menos um campo para atualização.',
    );
  });

  it('PATCH /api/finance/accounts/:id should reject changing its type', async () => {
    await request(app.getHttpServer())
      .patch(`/api/finance/accounts/${checkingAccountId}`)
      .set('Cookie', sessionCookie)
      .send({
        type: 'SAVINGS_ACCOUNT',
      })
      .expect(400);
  });

  it('PATCH /api/finance/accounts/:id should not update another organization account', async () => {
    if (!otherAccountId) {
      throw new Error('Other organization account was not created');
    }

    await request(app.getHttpServer())
      .patch(`/api/finance/accounts/${otherAccountId}`)
      .set('Cookie', sessionCookie)
      .send({
        name: 'Conta invadida',
      })
      .expect(404);

    const account = await prisma.financialAccount.findUniqueOrThrow({
      where: {
        id: otherAccountId,
      },
    });

    expect(account.name).toBe('Conta externa');
  });

  it('PATCH /api/finance/accounts/:id should reject a duplicated normalized name', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/finance/accounts/${checkingAccountId}`)
      .set('Cookie', sessionCookie)
      .send({
        name: 'CAIXA FISICO',
      })
      .expect(409);

    expect(response.body.message).toBe(
      'Já existe uma conta financeira com este nome.',
    );

    const cashAccount = await prisma.financialAccount.findUniqueOrThrow({
      where: {
        id: cashAccountId,
      },
    });

    expect(cashAccount.name).toBe('Caixa físico');
  });

  it('PATCH /api/finance/accounts/:id should block opening balance changes after the first movement', async () => {
    const period = await prisma.financialPeriod.create({
      data: {
        organizationId,
        year: 2026,
        month: 9,
      },
    });

    const category = await prisma.financialCategory.create({
      data: {
        organizationId,
        name: 'Receita de teste',
        normalizedName: 'receita de teste',
        type: 'REVENUE',
      },
    });

    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: period.id,
        categoryId: category.id,
        description: 'Recebimento de teste',
        amount: '100.00',
        dueDate: new Date('2026-09-05T00:00:00.000Z'),
        status: 'SETTLED',
      },
    });

    await prisma.financialSettlement.create({
      data: {
        organizationId,
        entryId: entry.id,
        accountId: checkingAccountId,
        amount: '100.00',
        settledAt: new Date('2026-09-05T12:00:00.000Z'),
      },
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/finance/accounts/${checkingAccountId}`)
      .set('Cookie', sessionCookie)
      .send({
        openingBalance: '2000.00',
      })
      .expect(400);

    expect(response.body.message).toBe(
      'O saldo inicial não pode ser alterado após a primeira movimentação.',
    );

    const account = await prisma.financialAccount.findUniqueOrThrow({
      where: {
        id: checkingAccountId,
      },
    });

    expect(account.openingBalance.toFixed(2)).toBe('1500.25');
  });

  it('POST /api/finance/accounts should reject invalid and additional fields', async () => {
    await request(app.getHttpServer())
      .post('/api/finance/accounts')
      .set('Cookie', sessionCookie)
      .send({
        name: 'Conta inválida',
        type: 'CASH',
        openingBalance: '10.999',
        organizationId: randomUUID(),
      })
      .expect(400);
  });

  it('should reject an unauthenticated request', async () => {
    await request(app.getHttpServer()).get('/api/finance/accounts').expect(401);
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
        prisma.financialSettlement.deleteMany({
          where: {
            organizationId,
          },
        }),
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
        prisma.financialAccount.deleteMany({
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
