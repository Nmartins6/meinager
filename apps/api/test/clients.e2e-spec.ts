import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/database/prisma.service.js';

describe('ClientsController (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let sessionCookie: string;
  let userId: string;
  let organizationId: string;
  let clientId: string | undefined;
  let otherOrganizationId: string | undefined;
  let otherClientId: string | undefined;

  const registrationPayload = {
    name: 'Proprietário Clientes E2E',
    email: `clients.${randomUUID()}@example.com`,
    password: 'senha-e2e-segura',
    organizationName: 'Empresa Clientes E2E',
  };

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
      .send(registrationPayload)
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

  it('POST /api/clients should create a client in the authenticated organization', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/clients')
      .set('Cookie', sessionCookie)
      .send({
        type: 'INDIVIDUAL',
        name: '  Cliente E2E  ',
        document: '123.456.789-01',
        phone: '(51) 99999-9999',
        email: 'CLIENTE@EXAMPLE.COM',
        notes: '  Cliente criado pelo teste  ',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      type: 'INDIVIDUAL',
      name: 'Cliente E2E',
      document: '12345678901',
      phone: '51999999999',
      email: 'cliente@example.com',
      notes: 'Cliente criado pelo teste',
      isActive: true,
    });

    clientId = response.body.id;

    const persistedClient = await prisma.client.findUniqueOrThrow({
      where: {
        id: clientId,
      },
    });

    expect(persistedClient.organizationId).toBe(organizationId);

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        entityType: 'client',
        entityId: clientId,
        action: 'client.created',
      },
    });

    expect(auditLog.actorUserId).toBe(userId);
  });

  it('GET /api/clients should list only clients from the authenticated organization', async () => {
    if (!clientId) {
      throw new Error('Client was not created');
    }

    const otherOrganization = await prisma.organization.create({
      data: {
        name: 'Outra Empresa E2E',
        slug: `outra-empresa-${randomUUID()}`,
      },
    });

    otherOrganizationId = otherOrganization.id;

    const otherClient = await prisma.client.create({
      data: {
        organizationId: otherOrganization.id,
        name: 'Cliente Externo',
        document: '12345678901',
      },
    });
    otherClientId = otherClient.id;

    const response = await request(app.getHttpServer())
      .get('/api/clients')
      .query({
        search: 'Cliente',
        isActive: true,
        page: 1,
        pageSize: 10,
      })
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      data: [
        {
          id: clientId,
          name: 'Cliente E2E',
          document: '12345678901',
        },
      ],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      },
    });

    expect(
      response.body.data.some(
        (client: { name: string }) => client.name === 'Cliente Externo',
      ),
    ).toBe(false);
  });

  it('GET /api/clients/:id should return a client from the authenticated organization', async () => {
    if (!clientId) {
      throw new Error('Client was not created');
    }

    const response = await request(app.getHttpServer())
      .get(`/api/clients/${clientId}`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      id: clientId,
      name: 'Cliente E2E',
      document: '12345678901',
    });
  });

  it('GET /api/clients/:id should not expose a client from another organization', async () => {
    if (!otherClientId) {
      throw new Error('External client was not created');
    }

    const response = await request(app.getHttpServer())
      .get(`/api/clients/${otherClientId}`)
      .set('Cookie', sessionCookie)
      .expect(404);

    expect(response.body.message).toBe('Cliente não encontrado.');
  });

  it('PATCH /api/clients/:id should update and deactivate a client', async () => {
    if (!clientId) {
      throw new Error('Client was not created');
    }

    const response = await request(app.getHttpServer())
      .patch(`/api/clients/${clientId}`)
      .set('Cookie', sessionCookie)
      .send({
        name: 'Cliente E2E Atualizado',
        phone: '',
        isActive: false,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: clientId,
      name: 'Cliente E2E Atualizado',
      phone: null,
      isActive: false,
    });

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        actorUserId: userId,
        entityType: 'client',
        entityId: clientId,
        action: 'client.updated',
      },
    });

    expect(auditLog.entityId).toBe(clientId);
  });

  it('PATCH /api/clients/:id should not update a client from another organization', async () => {
    if (!otherClientId) {
      throw new Error('External client was not created');
    }

    const response = await request(app.getHttpServer())
      .patch(`/api/clients/${otherClientId}`)
      .set('Cookie', sessionCookie)
      .send({
        name: 'Tentativa indevida',
      })
      .expect(404);

    expect(response.body.message).toBe('Cliente não encontrado.');
  });

  it('PATCH /api/clients/:id should reject an empty payload', async () => {
    if (!clientId) {
      throw new Error('Client was not created');
    }

    const response = await request(app.getHttpServer())
      .patch(`/api/clients/${clientId}`)
      .set('Cookie', sessionCookie)
      .send({})
      .expect(400);

    expect(response.body.message).toBe(
      'Informe ao menos um campo para atualizar.',
    );
  });

  it('POST /api/clients should reject a duplicated document', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/clients')
      .set('Cookie', sessionCookie)
      .send({
        name: 'Cliente duplicado',
        document: '12345678901',
      })
      .expect(409);

    expect(response.body.message).toBe(
      'Já existe um cliente com este CPF ou CNPJ.',
    );
  });

  it('POST /api/clients should reject organizationId from the request body', async () => {
    await request(app.getHttpServer())
      .post('/api/clients')
      .set('Cookie', sessionCookie)
      .send({
        name: 'Cliente inválido',
        organizationId: randomUUID(),
      })
      .expect(400);
  });

  it('POST /api/clients should reject an unauthenticated request', async () => {
    await request(app.getHttpServer())
      .post('/api/clients')
      .send({
        name: 'Cliente sem sessão',
      })
      .expect(401);
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
