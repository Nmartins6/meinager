import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/database/prisma.service.js';

describe('Financial categories (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let sessionCookie: string;
  let userId: string;
  let organizationId: string;
  let otherOrganizationId: string | undefined;
  let fixedCategoryId: string;
  let otherCategoryId: string | undefined;

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
        name: 'Financeiro E2E',
        email: `finance.${randomUUID()}@example.com`,
        password: 'senha-e2e-segura',
        organizationName: 'Empresa Financeira E2E',
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

  it('POST /api/finance/categories should create a category', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/finance/categories')
      .set('Cookie', sessionCookie)
      .send({
        name: '  Aluguel  ',
        type: 'FIXED_EXPENSE',
      })
      .expect(201);

    fixedCategoryId = response.body.id;

    expect(response.body).toMatchObject({
      name: 'Aluguel',
      type: 'FIXED_EXPENSE',
      isActive: true,
    });

    const persistedCategory = await prisma.financialCategory.findUniqueOrThrow({
      where: {
        id: response.body.id,
      },
    });

    expect(persistedCategory.organizationId).toBe(organizationId);
    expect(persistedCategory.normalizedName).toBe('aluguel');

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        action: 'financial_category.created',
        entityId: response.body.id,
      },
    });

    expect(auditLog.entityType).toBe('financial_category');
  });

  it('should allow the same name for a different category type', async () => {
    await request(app.getHttpServer())
      .post('/api/finance/categories')
      .set('Cookie', sessionCookie)
      .send({
        name: 'Aluguel',
        type: 'VARIABLE_EXPENSE',
      })
      .expect(201);
  });

  it('should reject a duplicated name in the same category type', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/finance/categories')
      .set('Cookie', sessionCookie)
      .send({
        name: 'ÁLUGUEL',
        type: 'FIXED_EXPENSE',
      })
      .expect(409);

    expect(response.body.message).toBe(
      'Já existe uma categoria com este nome e tipo.',
    );
  });

  it('GET /api/finance/categories should filter and isolate categories', async () => {
    const otherOrganization = await prisma.organization.create({
      data: {
        name: 'Outra Empresa Financeira',
        slug: `outra-financeira-${randomUUID()}`,
      },
    });

    otherOrganizationId = otherOrganization.id;

    const otherCategory = await prisma.financialCategory.create({
      data: {
        organizationId: otherOrganization.id,
        name: 'Categoria externa',
        normalizedName: 'categoria externa',
        type: 'FIXED_EXPENSE',
      },
    });

    otherCategoryId = otherCategory.id;

    const response = await request(app.getHttpServer())
      .get('/api/finance/categories')
      .query({
        type: 'FIXED_EXPENSE',
        isActive: true,
      })
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      name: 'Aluguel',
      type: 'FIXED_EXPENSE',
    });

    expect(
      response.body.some(
        (category: { name: string }) => category.name === 'Categoria externa',
      ),
    ).toBe(false);
  });

  it('PATCH /api/finance/categories/:id should update and deactivate a category', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/finance/categories/${fixedCategoryId}`)
      .set('Cookie', sessionCookie)
      .send({
        name: '  Aluguel comercial  ',
        isActive: false,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: fixedCategoryId,
      name: 'Aluguel comercial',
      type: 'FIXED_EXPENSE',
      isActive: false,
    });

    const persistedCategory = await prisma.financialCategory.findUniqueOrThrow({
      where: {
        id: fixedCategoryId,
      },
    });

    expect(persistedCategory.normalizedName).toBe('aluguel comercial');
    expect(persistedCategory.isActive).toBe(false);

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        action: 'financial_category.updated',
        entityId: fixedCategoryId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    expect(auditLog.metadata).toEqual({
      previous: {
        name: 'Aluguel',
        isActive: true,
      },
      current: {
        name: 'Aluguel comercial',
        isActive: false,
      },
    });
  });

  it('PATCH /api/finance/categories/:id should reject an empty payload', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/finance/categories/${fixedCategoryId}`)
      .set('Cookie', sessionCookie)
      .send({})
      .expect(400);

    expect(response.body.message).toBe(
      'Informe ao menos um campo para atualização.',
    );
  });

  it('PATCH /api/finance/categories/:id should reject changing its type', async () => {
    await request(app.getHttpServer())
      .patch(`/api/finance/categories/${fixedCategoryId}`)
      .set('Cookie', sessionCookie)
      .send({
        type: 'REVENUE',
      })
      .expect(400);
  });

  it('PATCH /api/finance/categories/:id should not update another organization category', async () => {
    if (!otherCategoryId) {
      throw new Error('Other organization category was not created');
    }

    await request(app.getHttpServer())
      .patch(`/api/finance/categories/${otherCategoryId}`)
      .set('Cookie', sessionCookie)
      .send({
        name: 'Categoria invadida',
      })
      .expect(404);

    const category = await prisma.financialCategory.findUniqueOrThrow({
      where: {
        id: otherCategoryId,
      },
    });

    expect(category.name).toBe('Categoria externa');
  });

  it('PATCH /api/finance/categories/:id should reject a duplicated normalized name', async () => {
    await request(app.getHttpServer())
      .post('/api/finance/categories')
      .set('Cookie', sessionCookie)
      .send({
        name: 'Energia elétrica',
        type: 'FIXED_EXPENSE',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .patch(`/api/finance/categories/${fixedCategoryId}`)
      .set('Cookie', sessionCookie)
      .send({
        name: 'ENERGIA ELETRICA',
      })
      .expect(409);

    expect(response.body.message).toBe(
      'Já existe uma categoria com este nome e tipo.',
    );
  });

  it('should reject an unauthenticated request', async () => {
    await request(app.getHttpServer())
      .get('/api/finance/categories')
      .expect(401);
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
