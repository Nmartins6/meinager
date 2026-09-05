import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/database/prisma.service.js';

describe('Financial settlements (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let sessionCookie: string;
  let userId: string;
  let organizationId: string;
  let openPeriodId: string;
  let closedPeriodId: string;
  let fixedCategoryId: string;
  let activeAccountId: string;
  let inactiveAccountId: string;
  let otherOrganizationId: string;
  let otherPeriodId: string;
  let otherCategoryId: string;
  let otherAccountId: string;

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
        name: 'Baixas E2E',
        email: `settlements.${randomUUID()}@example.com`,
        password: 'senha-e2e-segura',
        organizationName: 'Empresa Baixas E2E',
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

    const closedPeriod = await prisma.financialPeriod.create({
      data: {
        organizationId,
        year: 2026,
        month: 8,
        status: 'CLOSED',
        revenueSource: 'ENTRIES',
        closedAt: new Date(),
      },
    });

    closedPeriodId = closedPeriod.id;

    const fixedCategory = await prisma.financialCategory.create({
      data: {
        organizationId,
        name: 'Despesa para baixas',
        normalizedName: 'despesa para baixas',
        type: 'FIXED_EXPENSE',
      },
    });

    fixedCategoryId = fixedCategory.id;

    const activeAccount = await prisma.financialAccount.create({
      data: {
        organizationId,
        name: 'Conta principal',
        normalizedName: 'conta principal',
        type: 'CHECKING_ACCOUNT',
      },
    });

    activeAccountId = activeAccount.id;

    const inactiveAccount = await prisma.financialAccount.create({
      data: {
        organizationId,
        name: 'Conta inativa',
        normalizedName: 'conta inativa',
        type: 'CASH',
        isActive: false,
      },
    });

    inactiveAccountId = inactiveAccount.id;

    const otherOrganization = await prisma.organization.create({
      data: {
        name: 'Outra Empresa Baixas',
        slug: `outra-empresa-baixas-${randomUUID()}`,
      },
    });

    otherOrganizationId = otherOrganization.id;

    const otherPeriod = await prisma.financialPeriod.create({
      data: {
        organizationId: otherOrganizationId,
        year: 2026,
        month: 9,
        revenueSource: 'ENTRIES',
      },
    });

    otherPeriodId = otherPeriod.id;

    const otherCategory = await prisma.financialCategory.create({
      data: {
        organizationId: otherOrganizationId,
        name: 'Despesa externa',
        normalizedName: 'despesa externa',
        type: 'FIXED_EXPENSE',
      },
    });

    otherCategoryId = otherCategory.id;

    const otherAccount = await prisma.financialAccount.create({
      data: {
        organizationId: otherOrganizationId,
        name: 'Conta externa',
        normalizedName: 'conta externa',
        type: 'CHECKING_ACCOUNT',
      },
    });

    otherAccountId = otherAccount.id;
  });

  it('POST should register a partial settlement', async () => {
    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: openPeriodId,
        categoryId: fixedCategoryId,
        description: 'Despesa com baixa parcial',
        amount: '1000.00',
        dueDate: new Date('2026-09-10T00:00:00.000Z'),
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/finance/entries/${entry.id}/settlements`)
      .set('Cookie', sessionCookie)
      .send({
        accountId: activeAccountId,
        amount: '400',
        settledAt: '2026-09-05',
        notes: '  Primeira parcela  ',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      settlement: {
        amount: '400.00',
        settledAt: '2026-09-05',
        notes: 'Primeira parcela',
        reversedAt: null,
        reversalReason: null,
        account: {
          id: activeAccountId,
          name: 'Conta principal',
          type: 'CHECKING_ACCOUNT',
        },
      },
      entry: {
        id: entry.id,
        status: 'PARTIAL',
        amount: '1000.00',
        settledAmount: '400.00',
        remainingAmount: '600.00',
      },
    });

    const persistedEntry = await prisma.financialEntry.findUniqueOrThrow({
      where: {
        id: entry.id,
      },
    });

    expect(persistedEntry.status).toBe('PARTIAL');

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        action: 'financial_settlement.created',
        entityId: response.body.settlement.id,
      },
    });

    expect(auditLog.metadata).toEqual({
      entryId: entry.id,
      accountId: activeAccountId,
      amount: '400.00',
      settledAt: '2026-09-05',
      previousStatus: 'PENDING',
      currentStatus: 'PARTIAL',
      settledAmount: '400.00',
      remainingAmount: '600.00',
    });
  });

  it('POST should complete an entry using multiple settlements', async () => {
    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: openPeriodId,
        categoryId: fixedCategoryId,
        description: 'Despesa com duas parcelas',
        amount: '1000.00',
        dueDate: new Date('2026-09-11T00:00:00.000Z'),
      },
    });

    await request(app.getHttpServer())
      .post(`/api/finance/entries/${entry.id}/settlements`)
      .set('Cookie', sessionCookie)
      .send({
        accountId: activeAccountId,
        amount: '250.00',
        settledAt: '2026-09-05',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post(`/api/finance/entries/${entry.id}/settlements`)
      .set('Cookie', sessionCookie)
      .send({
        accountId: activeAccountId,
        amount: '750.00',
        settledAt: '2026-09-05',
      })
      .expect(201);

    expect(response.body.entry).toEqual({
      id: entry.id,
      status: 'SETTLED',
      amount: '1000.00',
      settledAmount: '1000.00',
      remainingAmount: '0.00',
    });

    const persistedEntry = await prisma.financialEntry.findUniqueOrThrow({
      where: {
        id: entry.id,
      },
    });

    expect(persistedEntry.status).toBe('SETTLED');
  });

  it('POST should allow a settlement in a closed period', async () => {
    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: closedPeriodId,
        categoryId: fixedCategoryId,
        description: 'Despesa de competência fechada',
        amount: '500.00',
        dueDate: new Date('2026-08-15T00:00:00.000Z'),
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/finance/entries/${entry.id}/settlements`)
      .set('Cookie', sessionCookie)
      .send({
        accountId: activeAccountId,
        amount: '500.00',
        settledAt: '2026-09-05',
      })
      .expect(201);

    expect(response.body.entry).toMatchObject({
      id: entry.id,
      status: 'SETTLED',
      remainingAmount: '0.00',
    });
  });

  it('GET should list the complete history and summarize only active settlements', async () => {
    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: openPeriodId,
        categoryId: fixedCategoryId,
        description: 'Despesa com histórico',
        amount: '500.00',
        dueDate: new Date('2026-09-12T00:00:00.000Z'),
        status: 'PARTIAL',
      },
    });

    const activeSettlement = await prisma.financialSettlement.create({
      data: {
        organizationId,
        entryId: entry.id,
        accountId: activeAccountId,
        amount: '200.00',
        settledAt: new Date('2026-09-03T00:00:00.000Z'),
      },
    });

    const reversedSettlement = await prisma.financialSettlement.create({
      data: {
        organizationId,
        entryId: entry.id,
        accountId: activeAccountId,
        amount: '100.00',
        settledAt: new Date('2026-09-04T00:00:00.000Z'),
        reversedAt: new Date(),
        reversalReason: 'Baixa incorreta',
      },
    });

    const response = await request(app.getHttpServer())
      .get(`/api/finance/entries/${entry.id}/settlements`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(response.body.entry).toEqual({
      id: entry.id,
      status: 'PARTIAL',
      amount: '500.00',
      settledAmount: '200.00',
      remainingAmount: '300.00',
    });

    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).toMatchObject({
      id: reversedSettlement.id,
      amount: '100.00',
      settledAt: '2026-09-04',
      reversalReason: 'Baixa incorreta',
    });
    expect(response.body.data[0].reversedAt).toEqual(expect.any(String));

    expect(response.body.data[1]).toMatchObject({
      id: activeSettlement.id,
      amount: '200.00',
      settledAt: '2026-09-03',
      reversedAt: null,
      reversalReason: null,
    });
  });

  it('POST should reject a settlement greater than the remaining amount', async () => {
    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: openPeriodId,
        categoryId: fixedCategoryId,
        description: 'Despesa com tentativa de excesso',
        amount: '500.00',
        dueDate: new Date('2026-09-13T00:00:00.000Z'),
      },
    });

    await request(app.getHttpServer())
      .post(`/api/finance/entries/${entry.id}/settlements`)
      .set('Cookie', sessionCookie)
      .send({
        accountId: activeAccountId,
        amount: '400.00',
        settledAt: '2026-09-05',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post(`/api/finance/entries/${entry.id}/settlements`)
      .set('Cookie', sessionCookie)
      .send({
        accountId: activeAccountId,
        amount: '100.01',
        settledAt: '2026-09-05',
      })
      .expect(400);

    expect(response.body.message).toBe(
      'O valor da baixa ultrapassa o saldo restante do lançamento.',
    );

    const persistedEntry = await prisma.financialEntry.findUniqueOrThrow({
      where: {
        id: entry.id,
      },
    });

    expect(persistedEntry.status).toBe('PARTIAL');

    const settlementCount = await prisma.financialSettlement.count({
      where: {
        entryId: entry.id,
        reversedAt: null,
      },
    });

    expect(settlementCount).toBe(1);
  });

  it('POST should reject an inactive financial account', async () => {
    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: openPeriodId,
        categoryId: fixedCategoryId,
        description: 'Despesa com conta inativa',
        amount: '200.00',
        dueDate: new Date('2026-09-14T00:00:00.000Z'),
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/finance/entries/${entry.id}/settlements`)
      .set('Cookie', sessionCookie)
      .send({
        accountId: inactiveAccountId,
        amount: '100.00',
        settledAt: '2026-09-05',
      })
      .expect(400);

    expect(response.body.message).toBe(
      'Não é possível usar uma conta financeira inativa.',
    );
  });

  it('POST should not use another organization account', async () => {
    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: openPeriodId,
        categoryId: fixedCategoryId,
        description: 'Despesa com conta externa',
        amount: '200.00',
        dueDate: new Date('2026-09-15T00:00:00.000Z'),
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/finance/entries/${entry.id}/settlements`)
      .set('Cookie', sessionCookie)
      .send({
        accountId: otherAccountId,
        amount: '100.00',
        settledAt: '2026-09-05',
      })
      .expect(404);

    expect(response.body.message).toBe('Conta financeira não encontrada.');
  });

  it('POST should not use another organization entry', async () => {
    const externalEntry = await prisma.financialEntry.create({
      data: {
        organizationId: otherOrganizationId,
        periodId: otherPeriodId,
        categoryId: otherCategoryId,
        description: 'Lançamento externo para baixa',
        amount: '300.00',
        dueDate: new Date('2026-09-16T00:00:00.000Z'),
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/finance/entries/${externalEntry.id}/settlements`)
      .set('Cookie', sessionCookie)
      .send({
        accountId: activeAccountId,
        amount: '100.00',
        settledAt: '2026-09-05',
      })
      .expect(404);

    expect(response.body.message).toBe('Lançamento financeiro não encontrado.');
  });

  it('POST should reject a cancelled entry', async () => {
    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: openPeriodId,
        categoryId: fixedCategoryId,
        description: 'Lançamento cancelado para baixa',
        amount: '300.00',
        dueDate: new Date('2026-09-17T00:00:00.000Z'),
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/finance/entries/${entry.id}/settlements`)
      .set('Cookie', sessionCookie)
      .send({
        accountId: activeAccountId,
        amount: '100.00',
        settledAt: '2026-09-05',
      })
      .expect(400);

    expect(response.body.message).toBe(
      'Não é possível registrar uma baixa em um lançamento cancelado.',
    );
  });

  it('POST should reject zero and protected fields', async () => {
    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: openPeriodId,
        categoryId: fixedCategoryId,
        description: 'Lançamento para baixa inválida',
        amount: '300.00',
        dueDate: new Date('2026-09-18T00:00:00.000Z'),
      },
    });

    await request(app.getHttpServer())
      .post(`/api/finance/entries/${entry.id}/settlements`)
      .set('Cookie', sessionCookie)
      .send({
        accountId: activeAccountId,
        amount: '0.00',
        settledAt: '2026-09-05',
        organizationId: otherOrganizationId,
        entryId: randomUUID(),
        reversedAt: new Date().toISOString(),
      })
      .expect(400);

    const settlementCount = await prisma.financialSettlement.count({
      where: {
        entryId: entry.id,
      },
    });

    expect(settlementCount).toBe(0);
  });

  it('should reject unauthenticated settlement requests', async () => {
    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: openPeriodId,
        categoryId: fixedCategoryId,
        description: 'Lançamento protegido',
        amount: '300.00',
        dueDate: new Date('2026-09-19T00:00:00.000Z'),
      },
    });

    await request(app.getHttpServer())
      .get(`/api/finance/entries/${entry.id}/settlements`)
      .expect(401);

    await request(app.getHttpServer())
      .post(`/api/finance/entries/${entry.id}/settlements`)
      .send({
        accountId: activeAccountId,
        amount: '100.00',
        settledAt: '2026-09-05',
      })
      .expect(401);
  });

  it('POST reverse should recalculate SETTLED to PARTIAL and then PENDING', async () => {
    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: openPeriodId,
        categoryId: fixedCategoryId,
        description: 'Despesa para estorno completo',
        amount: '1000.00',
        dueDate: new Date('2026-09-20T00:00:00.000Z'),
        status: 'SETTLED',
      },
    });

    const firstSettlement = await prisma.financialSettlement.create({
      data: {
        organizationId,
        entryId: entry.id,
        accountId: activeAccountId,
        amount: '400.00',
        settledAt: new Date('2026-09-05T00:00:00.000Z'),
      },
    });

    const secondSettlement = await prisma.financialSettlement.create({
      data: {
        organizationId,
        entryId: entry.id,
        accountId: activeAccountId,
        amount: '600.00',
        settledAt: new Date('2026-09-05T00:00:00.000Z'),
      },
    });

    const partialResponse = await request(app.getHttpServer())
      .post(`/api/finance/settlements/${secondSettlement.id}/reverse`)
      .set('Cookie', sessionCookie)
      .send({
        reason: '  Pagamento registrado incorretamente  ',
      })
      .expect(201);

    expect(partialResponse.body).toMatchObject({
      settlement: {
        id: secondSettlement.id,
        amount: '600.00',
        reversalReason: 'Pagamento registrado incorretamente',
      },
      entry: {
        id: entry.id,
        status: 'PARTIAL',
        amount: '1000.00',
        settledAmount: '400.00',
        remainingAmount: '600.00',
      },
    });
    expect(partialResponse.body.settlement.reversedAt).toEqual(
      expect.any(String),
    );

    const firstAuditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        action: 'financial_settlement.reversed',
        entityId: secondSettlement.id,
      },
    });

    expect(firstAuditLog.metadata).toEqual({
      entryId: entry.id,
      accountId: activeAccountId,
      amount: '600.00',
      reason: 'Pagamento registrado incorretamente',
      reversedAt: partialResponse.body.settlement.reversedAt,
      previousStatus: 'SETTLED',
      currentStatus: 'PARTIAL',
      settledAmount: '400.00',
      remainingAmount: '600.00',
    });

    const pendingResponse = await request(app.getHttpServer())
      .post(`/api/finance/settlements/${firstSettlement.id}/reverse`)
      .set('Cookie', sessionCookie)
      .send({
        reason: 'Pagamento também deve ser removido',
      })
      .expect(201);

    expect(pendingResponse.body.entry).toEqual({
      id: entry.id,
      status: 'PENDING',
      amount: '1000.00',
      settledAmount: '0.00',
      remainingAmount: '1000.00',
    });

    const persistedEntry = await prisma.financialEntry.findUniqueOrThrow({
      where: {
        id: entry.id,
      },
    });

    expect(persistedEntry.status).toBe('PENDING');

    const repeatedResponse = await request(app.getHttpServer())
      .post(`/api/finance/settlements/${secondSettlement.id}/reverse`)
      .set('Cookie', sessionCookie)
      .send({
        reason: 'Tentativa repetida',
      })
      .expect(400);

    expect(repeatedResponse.body.message).toBe(
      'A baixa financeira já foi estornada.',
    );
  });

  it('POST reverse should require authentication and a reason', async () => {
    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: openPeriodId,
        categoryId: fixedCategoryId,
        description: 'Despesa para validar estorno',
        amount: '300.00',
        dueDate: new Date('2026-09-21T00:00:00.000Z'),
        status: 'PARTIAL',
      },
    });

    const settlement = await prisma.financialSettlement.create({
      data: {
        organizationId,
        entryId: entry.id,
        accountId: activeAccountId,
        amount: '100.00',
        settledAt: new Date('2026-09-05T00:00:00.000Z'),
      },
    });

    await request(app.getHttpServer())
      .post(`/api/finance/settlements/${settlement.id}/reverse`)
      .send({
        reason: 'Tentativa sem autenticação',
      })
      .expect(401);

    await request(app.getHttpServer())
      .post(`/api/finance/settlements/${settlement.id}/reverse`)
      .set('Cookie', sessionCookie)
      .send({
        reason: ' ',
      })
      .expect(400);

    const persistedSettlement =
      await prisma.financialSettlement.findUniqueOrThrow({
        where: {
          id: settlement.id,
        },
      });

    expect(persistedSettlement.reversedAt).toBeNull();
    expect(persistedSettlement.reversalReason).toBeNull();
  });

  it('POST reverse should not expose another organization settlement', async () => {
    const externalEntry = await prisma.financialEntry.create({
      data: {
        organizationId: otherOrganizationId,
        periodId: otherPeriodId,
        categoryId: otherCategoryId,
        description: 'Lançamento externo para estorno',
        amount: '400.00',
        dueDate: new Date('2026-09-22T00:00:00.000Z'),
        status: 'PARTIAL',
      },
    });

    const externalSettlement = await prisma.financialSettlement.create({
      data: {
        organizationId: otherOrganizationId,
        entryId: externalEntry.id,
        accountId: otherAccountId,
        amount: '100.00',
        settledAt: new Date('2026-09-05T00:00:00.000Z'),
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/finance/settlements/${externalSettlement.id}/reverse`)
      .set('Cookie', sessionCookie)
      .send({
        reason: 'Tentativa entre organizações',
      })
      .expect(404);

    expect(response.body.message).toBe('Baixa financeira não encontrada.');

    const persistedSettlement =
      await prisma.financialSettlement.findUniqueOrThrow({
        where: {
          id: externalSettlement.id,
        },
      });

    expect(persistedSettlement.reversedAt).toBeNull();
  });

  it('POST reverse should allow an adjustment in a closed period', async () => {
    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: closedPeriodId,
        categoryId: fixedCategoryId,
        description: 'Despesa fechada para estorno',
        amount: '350.00',
        dueDate: new Date('2026-08-20T00:00:00.000Z'),
        status: 'SETTLED',
      },
    });

    const settlement = await prisma.financialSettlement.create({
      data: {
        organizationId,
        entryId: entry.id,
        accountId: activeAccountId,
        amount: '350.00',
        settledAt: new Date('2026-09-05T00:00:00.000Z'),
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/finance/settlements/${settlement.id}/reverse`)
      .set('Cookie', sessionCookie)
      .send({
        reason: 'Correção após fechamento da competência',
      })
      .expect(201);

    expect(response.body.entry).toEqual({
      id: entry.id,
      status: 'PENDING',
      amount: '350.00',
      settledAmount: '0.00',
      remainingAmount: '350.00',
    });
  });

  it('POST should serialize concurrent settlements and prevent overpayment', async () => {
    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: openPeriodId,
        categoryId: fixedCategoryId,
        description: 'Despesa com baixas simultâneas',
        amount: '100.00',
        dueDate: new Date('2026-09-23T00:00:00.000Z'),
      },
    });

    const createSettlement = () =>
      request(app.getHttpServer())
        .post(`/api/finance/entries/${entry.id}/settlements`)
        .set('Cookie', sessionCookie)
        .send({
          accountId: activeAccountId,
          amount: '60.00',
          settledAt: '2026-09-05',
        });

    const responses = await Promise.all([
      createSettlement(),
      createSettlement(),
    ]);

    const statuses = responses
      .map((response) => response.status)
      .sort((first, second) => first - second);

    expect(statuses).toEqual([201, 400]);

    const rejectedResponse = responses.find(
      (response) => response.status === 400,
    );

    expect(rejectedResponse?.body.message).toBe(
      'O valor da baixa ultrapassa o saldo restante do lançamento.',
    );

    const activeSettlementAggregate =
      await prisma.financialSettlement.aggregate({
        where: {
          entryId: entry.id,
          reversedAt: null,
        },
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      });

    expect(activeSettlementAggregate._count.id).toBe(1);
    expect(activeSettlementAggregate._sum.amount?.toFixed(2)).toBe('60.00');

    const persistedEntry = await prisma.financialEntry.findUniqueOrThrow({
      where: {
        id: entry.id,
      },
    });

    expect(persistedEntry.status).toBe('PARTIAL');
  });

  afterAll(async () => {
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
