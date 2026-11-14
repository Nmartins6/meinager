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
  let sessionCookie: string | undefined;

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

    expect(response.body).not.toHaveProperty('session');
    expect(JSON.stringify(response.body)).not.toContain('raw-session-token');

    const setCookieHeader = response.headers['set-cookie'];
    const setCookie = Array.isArray(setCookieHeader)
      ? setCookieHeader[0]
      : setCookieHeader;

    if (!setCookie) {
      throw new Error('Session cookie was not returned');
    }

    sessionCookie = setCookie.split(';', 1)[0];

    expect(setCookie).toContain('meinager_session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).not.toContain('Secure');

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

    const persistedSession = await prisma.session.findFirstOrThrow({
      where: {
        userId,
      },
    });

    expect(persistedSession.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(setCookie).not.toContain(persistedSession.tokenHash);
  });

  it('POST /api/auth/login should authenticate and create a new session', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: email.toUpperCase(),
        password,
      })
      .expect(200);

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

    expect(response.body).not.toHaveProperty('session');
    expect(response.body.user).not.toHaveProperty('passwordHash');

    const setCookieHeader = response.headers['set-cookie'];
    const sessionCookie = Array.isArray(setCookieHeader)
      ? setCookieHeader[0]
      : setCookieHeader;

    if (!sessionCookie) {
      throw new Error('Login session cookie was not returned');
    }

    expect(sessionCookie).toContain('meinager_session=');
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('SameSite=Lax');

    const sessionCount = await prisma.session.count({
      where: {
        userId,
        revokedAt: null,
      },
    });

    expect(sessionCount).toBe(2);
  });

  it('GET /api/auth/me should return the authenticated user', async () => {
    if (!sessionCookie) {
      throw new Error('Session cookie is not available');
    }

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      user: {
        id: userId,
        name: payload.name,
        email: payload.email,
      },
      organization: {
        id: organizationId,
        name: payload.organizationName,
        role: 'OWNER',
      },
    });

    expect(response.body).not.toHaveProperty('sessionId');
    expect(response.body.user).not.toHaveProperty('passwordHash');
  });

  it('GET /api/auth/me should reject a request without a session', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .expect(401);

    expect(response.body.message).toBe('Sessão inválida ou expirada.');
  });

  it('POST /api/auth/logout should revoke the session and clear the cookie', async () => {
    if (!sessionCookie) {
      throw new Error('Session cookie is not available');
    }

    const logoutResponse = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', sessionCookie)
      .expect(204);

    const setCookieHeader = logoutResponse.headers['set-cookie'];
    const clearedCookie = Array.isArray(setCookieHeader)
      ? setCookieHeader[0]
      : setCookieHeader;

    expect(clearedCookie).toContain('meinager_session=');
    expect(clearedCookie).toContain('Expires=Thu, 01 Jan 1970');
    expect(clearedCookie).toContain('HttpOnly');
    expect(clearedCookie).toContain('SameSite=Lax');

    const revokedResponse = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', sessionCookie)
      .expect(401);

    expect(revokedResponse.body.message).toBe('Sessão inválida ou expirada.');
  });

  it('POST /api/auth/login should reject an invalid password', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email,
        password: 'senha-incorreta',
      })
      .expect(401);

    expect(response.body.message).toBe('E-mail ou senha inválidos.');
    expect(response.headers['set-cookie']).toBeUndefined();
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
    // Active sessions reference membership; remove only this fixture's sessions first.
    if (userId) {
      await prisma.session.deleteMany({ where: { userId } });
    }

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
