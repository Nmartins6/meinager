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

  it('GET /api/finance/entries/:id should return an organization entry', async () => {
    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: openPeriodId,
        categoryId: fixedCategoryId,
        clientId: activeClientId,
        description: 'Despesa para consulta individual',
        amount: '450.00',
        dueDate: new Date('2026-09-12T00:00:00.000Z'),
        notes: 'Consulta individual',
      },
    });

    const response = await request(app.getHttpServer())
      .get(`/api/finance/entries/${entry.id}`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      id: entry.id,
      description: 'Despesa para consulta individual',
      amount: '450.00',
      dueDate: '2026-09-12',
      status: 'PENDING',
      origin: 'MANUAL',
      period: {
        id: openPeriodId,
      },
      category: {
        id: fixedCategoryId,
        type: 'FIXED_EXPENSE',
      },
      client: {
        id: activeClientId,
      },
    });
  });

  it('GET /api/finance/entries/:id should not expose another organization entry', async () => {
    const externalEntry = await prisma.financialEntry.create({
      data: {
        organizationId: otherOrganizationId,
        periodId: otherPeriodId,
        categoryId: otherCategoryId,
        description: 'Lançamento externo individual',
        amount: '700.00',
        dueDate: new Date('2026-09-15T00:00:00.000Z'),
      },
    });

    await request(app.getHttpServer())
      .get(`/api/finance/entries/${externalEntry.id}`)
      .set('Cookie', sessionCookie)
      .expect(404);
  });

  it('PATCH /api/finance/entries/:id should update an open entry', async () => {
    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: openPeriodId,
        categoryId: fixedCategoryId,
        description: 'Despesa antes da edição',
        amount: '450.00',
        dueDate: new Date('2026-09-12T00:00:00.000Z'),
        notes: 'Observação anterior',
      },
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/finance/entries/${entry.id}`)
      .set('Cookie', sessionCookie)
      .send({
        clientId: activeClientId,
        description: '  Despesa depois da edição  ',
        amount: '475.25',
        dueDate: '2026-09-18',
        notes: '',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: entry.id,
      description: 'Despesa depois da edição',
      amount: '475.25',
      dueDate: '2026-09-18',
      status: 'PENDING',
      notes: null,
      period: {
        id: openPeriodId,
      },
      category: {
        id: fixedCategoryId,
        type: 'FIXED_EXPENSE',
      },
      client: {
        id: activeClientId,
      },
    });

    const persistedEntry = await prisma.financialEntry.findUniqueOrThrow({
      where: {
        id: entry.id,
      },
    });

    expect(persistedEntry.description).toBe('Despesa depois da edição');
    expect(persistedEntry.amount.toFixed(2)).toBe('475.25');
    expect(persistedEntry.dueDate.toISOString().slice(0, 10)).toBe(
      '2026-09-18',
    );
    expect(persistedEntry.clientId).toBe(activeClientId);
    expect(persistedEntry.notes).toBeNull();

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        action: 'financial_entry.updated',
        entityId: entry.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    expect(auditLog.metadata).toEqual({
      previous: {
        categoryId: fixedCategoryId,
        clientId: null,
        description: 'Despesa antes da edição',
        amount: '450.00',
        dueDate: '2026-09-12',
        notes: 'Observação anterior',
      },
      current: {
        categoryId: fixedCategoryId,
        clientId: activeClientId,
        description: 'Despesa depois da edição',
        amount: '475.25',
        dueDate: '2026-09-18',
        notes: null,
      },
    });
  });

  it('PATCH /api/finance/entries/:id should reject an empty payload', async () => {
    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: openPeriodId,
        categoryId: fixedCategoryId,
        description: 'Despesa sem atualização',
        amount: '100.00',
        dueDate: new Date('2026-09-20T00:00:00.000Z'),
      },
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/finance/entries/${entry.id}`)
      .set('Cookie', sessionCookie)
      .send({})
      .expect(400);

    expect(response.body.message).toBe(
      'Informe ao menos um campo para atualização.',
    );
  });

  it('PATCH /api/finance/entries/:id should reject a closed period', async () => {
    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: closedPeriodId,
        categoryId: fixedCategoryId,
        description: 'Despesa fechada',
        amount: '200.00',
        dueDate: new Date('2026-07-15T00:00:00.000Z'),
      },
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/finance/entries/${entry.id}`)
      .set('Cookie', sessionCookie)
      .send({
        description: 'Tentativa de alteração',
      })
      .expect(400);

    expect(response.body.message).toBe(
      'Não é possível alterar lançamentos de uma competência fechada.',
    );
  });

  it('POST /api/finance/entries/:id/cancel should cancel an open entry', async () => {
    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: openPeriodId,
        categoryId: fixedCategoryId,
        description: 'Despesa que será cancelada',
        amount: '300.00',
        dueDate: new Date('2026-09-22T00:00:00.000Z'),
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/finance/entries/${entry.id}/cancel`)
      .set('Cookie', sessionCookie)
      .send({
        reason: '  Cobrança criada em duplicidade  ',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      id: entry.id,
      status: 'CANCELLED',
    });
    expect(response.body.cancelledAt).toEqual(expect.any(String));

    const persistedEntry = await prisma.financialEntry.findUniqueOrThrow({
      where: {
        id: entry.id,
      },
    });

    expect(persistedEntry.status).toBe('CANCELLED');
    expect(persistedEntry.cancelledAt).not.toBeNull();

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        action: 'financial_entry.cancelled',
        entityId: entry.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    expect(auditLog.metadata).toEqual({
      reason: 'Cobrança criada em duplicidade',
      previousStatus: 'PENDING',
      currentStatus: 'CANCELLED',
      cancelledAt: response.body.cancelledAt,
    });

    const updateResponse = await request(app.getHttpServer())
      .patch(`/api/finance/entries/${entry.id}`)
      .set('Cookie', sessionCookie)
      .send({
        description: 'Tentativa de editar cancelado',
      })
      .expect(400);

    expect(updateResponse.body.message).toBe(
      'Não é possível alterar um lançamento cancelado.',
    );
  });

  it('POST /api/finance/entries/:id/cancel should require a reason', async () => {
    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: openPeriodId,
        categoryId: fixedCategoryId,
        description: 'Cancelamento sem motivo',
        amount: '150.00',
        dueDate: new Date('2026-09-23T00:00:00.000Z'),
      },
    });

    await request(app.getHttpServer())
      .post(`/api/finance/entries/${entry.id}/cancel`)
      .set('Cookie', sessionCookie)
      .send({
        reason: ' ',
      })
      .expect(400);

    const persistedEntry = await prisma.financialEntry.findUniqueOrThrow({
      where: {
        id: entry.id,
      },
    });

    expect(persistedEntry.status).toBe('PENDING');
    expect(persistedEntry.cancelledAt).toBeNull();
  });

  it('should protect amount, category and cancellation when an entry has payments', async () => {
    const account = await prisma.financialAccount.create({
      data: {
        organizationId,
        name: 'Conta para bloqueio de lançamento',
        normalizedName: 'conta para bloqueio de lancamento',
        type: 'CHECKING_ACCOUNT',
      },
    });

    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: openPeriodId,
        categoryId: fixedCategoryId,
        description: 'Despesa parcialmente paga',
        amount: '500.00',
        dueDate: new Date('2026-09-24T00:00:00.000Z'),
        status: 'PARTIAL',
      },
    });

    await prisma.financialSettlement.create({
      data: {
        organizationId,
        entryId: entry.id,
        accountId: account.id,
        amount: '100.00',
        settledAt: new Date(),
      },
    });

    const updateResponse = await request(app.getHttpServer())
      .patch(`/api/finance/entries/${entry.id}`)
      .set('Cookie', sessionCookie)
      .send({
        amount: '550.00',
      })
      .expect(400);

    expect(updateResponse.body.message).toBe(
      'Não é possível alterar o valor ou a categoria de um lançamento com pagamentos.',
    );

    const cancelResponse = await request(app.getHttpServer())
      .post(`/api/finance/entries/${entry.id}/cancel`)
      .set('Cookie', sessionCookie)
      .send({
        reason: 'Tentativa com pagamento ativo',
      })
      .expect(400);

    expect(cancelResponse.body.message).toBe(
      'Estorne os pagamentos antes de cancelar o lançamento.',
    );
  });

  it('POST /api/finance/entries/:id/duplicate-next-month should duplicate a fixed expense', async () => {
    const sourceEntry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: manualPeriodId,
        categoryId: fixedCategoryId,
        description: 'Aluguel recorrente',
        amount: '890.00',
        dueDate: new Date('2026-08-31T00:00:00.000Z'),
        notes: 'Duplicar manualmente',
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/finance/entries/${sourceEntry.id}/duplicate-next-month`)
      .set('Cookie', sessionCookie)
      .expect(201);

    expect(response.body).toMatchObject({
      description: 'Aluguel recorrente',
      amount: '890.00',
      dueDate: '2026-09-30',
      status: 'PENDING',
      origin: 'DUPLICATED',
      sourceEntryId: sourceEntry.id,
      notes: 'Duplicar manualmente',
      period: {
        id: openPeriodId,
        year: 2026,
        month: 9,
        status: 'OPEN',
      },
      category: {
        id: fixedCategoryId,
        type: 'FIXED_EXPENSE',
      },
      client: null,
    });

    const persistedEntry = await prisma.financialEntry.findUniqueOrThrow({
      where: {
        id: response.body.id,
      },
    });

    expect(persistedEntry.organizationId).toBe(organizationId);
    expect(persistedEntry.origin).toBe('DUPLICATED');
    expect(persistedEntry.sourceEntryId).toBe(sourceEntry.id);
    expect(persistedEntry.periodId).toBe(openPeriodId);
    expect(persistedEntry.dueDate.toISOString().slice(0, 10)).toBe(
      '2026-09-30',
    );

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        action: 'financial_entry.duplicated',
        entityId: response.body.id,
      },
    });

    expect(auditLog.metadata).toEqual({
      sourceEntryId: sourceEntry.id,
      sourcePeriodId: manualPeriodId,
      targetPeriodId: openPeriodId,
      amount: '890.00',
      dueDate: '2026-09-30',
    });

    const duplicateResponse = await request(app.getHttpServer())
      .post(`/api/finance/entries/${sourceEntry.id}/duplicate-next-month`)
      .set('Cookie', sessionCookie)
      .expect(409);

    expect(duplicateResponse.body.message).toBe(
      'Este lançamento já foi duplicado para a competência seguinte.',
    );
  });

  it('should only duplicate fixed expenses', async () => {
    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: openPeriodId,
        categoryId: revenueCategoryId,
        description: 'Receita não recorrente',
        amount: '600.00',
        dueDate: new Date('2026-09-25T00:00:00.000Z'),
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/finance/entries/${entry.id}/duplicate-next-month`)
      .set('Cookie', sessionCookie)
      .expect(400);

    expect(response.body.message).toBe(
      'Somente despesas fixas podem ser duplicadas para o mês seguinte.',
    );
  });

  it('should not duplicate a cancelled entry', async () => {
    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: openPeriodId,
        categoryId: fixedCategoryId,
        description: 'Despesa fixa cancelada',
        amount: '250.00',
        dueDate: new Date('2026-09-26T00:00:00.000Z'),
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/finance/entries/${entry.id}/duplicate-next-month`)
      .set('Cookie', sessionCookie)
      .expect(400);

    expect(response.body.message).toBe(
      'Não é possível duplicar um lançamento cancelado.',
    );
  });

  it('should require the next financial period for duplication', async () => {
    const entry = await prisma.financialEntry.create({
      data: {
        organizationId,
        periodId: openPeriodId,
        categoryId: fixedCategoryId,
        description: 'Despesa sem competência seguinte',
        amount: '275.00',
        dueDate: new Date('2026-09-27T00:00:00.000Z'),
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/finance/entries/${entry.id}/duplicate-next-month`)
      .set('Cookie', sessionCookie)
      .expect(404);

    expect(response.body.message).toBe(
      'A competência financeira do mês seguinte não foi encontrada.',
    );
  });

  it('should reject an unauthenticated request', async () => {
    await request(app.getHttpServer()).get('/api/finance/entries').expect(401);
  });

  afterAll(async () => {
    // Active sessions reference membership; remove only this fixture's sessions first.
    if (userId) {
      await prisma.session.deleteMany({ where: { userId } });
    }

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
