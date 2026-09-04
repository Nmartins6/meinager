import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { verify } from 'argon2';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/database/prisma.service.js';

describe('AuthController registration (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let userId: string | undefined;
  let organizationId: string | undefined;

  const email = `e2e.${randomUUID()}@example.com`;
  const password = 'senha-e2e-segura';

  const payload = {
    name: 'Usuário E2E',
    email,
    password,
    organizationName: 'Empresa E2E',
    segment: 'Serviços',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);

    await app.init();

    prisma = app.get(PrismaService);
  });

  it('POST /api/auth/register should create an owner and organization', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(payload)
      .expect(201);

    expect(response.body).toMatchObject({
      user: {
        name: payload.name,
        email: payload.email,
      },
      organization: {
        name: payload.organizationName,
        role: 'OWNER',
      },
    });

    expect(response.body.user).not.toHaveProperty('passwordHash');

    userId = response.body.user.id;
    organizationId = response.body.organization.id;

    const persistedUser = await prisma.user.findUniqueOrThrow({
      where: {
        id: userId,
      },
      include: {
        memberships: true,
      },
    });

    expect(persistedUser.normalizedEmail).toBe(email.toLowerCase());
    expect(persistedUser.memberships).toHaveLength(1);
    expect(persistedUser.memberships[0]?.role).toBe('OWNER');
    expect(await verify(persistedUser.passwordHash, password)).toBe(true);
  });

  it('POST /api/auth/register should reject duplicated email', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(payload)
      .expect(409);
  });

  it('POST /api/auth/register should reject invalid and additional fields', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'A',
        email: 'email-invalido',
        password: '123',
        organizationName: '',
        unexpectedField: true,
      })
      .expect(400);
  });

  afterAll(async () => {
    if (userId && organizationId) {
      await prisma.$transaction([
        prisma.auditLog.deleteMany({
          where: {
            organizationId,
          },
        }),
        prisma.organizationMember.deleteMany({
          where: {
            organizationId,
          },
        }),
        prisma.organization.deleteMany({
          where: {
            id: organizationId,
          },
        }),
        prisma.user.deleteMany({
          where: {
            id: userId,
          },
        }),
      ]);
    }

    await app.close();
  });
});
