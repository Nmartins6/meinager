import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { OrganizationRole } from '../src/generated/prisma/enums.js';

interface Identity {
  cookie: string;
  organizationId: string;
  userId: string;
}

describe('Pricing sales profiles (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let primary: Identity;
  let foreign: Identity;

  const server = () => app.getHttpServer();

  async function register(label: string): Promise<Identity> {
    const suffix = randomUUID();
    const response = await request(server())
      .post('/api/auth/register')
      .send({
        name: `Profiles ${label}`,
        email: `profiles.${label}.${suffix}@example.com`,
        password: 'senha-e2e-segura',
        organizationName: `Profiles ${label} ${suffix}`,
      })
      .expect(201);
    const header = response.headers['set-cookie'];
    const cookie = (Array.isArray(header) ? header[0] : header)?.split(
      ';',
      1,
    )[0];
    if (!cookie) throw new Error('Session cookie was not returned');
    return {
      cookie,
      organizationId: response.body.organization.id,
      userId: response.body.user.id,
    };
  }

  const deductions = () => [
    {
      name: 'Cartão',
      category: 'CARD',
      rate: '0.02500000',
      origin: 'MANUAL',
      originDetails: { source: 'contract' },
    },
    {
      name: 'Marketplace',
      category: 'CHANNEL_CUSTOM',
      rate: '0.10000000',
      origin: 'COPIED',
    },
  ];

  async function createProfile(
    label: string = randomUUID(),
    identity = primary,
  ) {
    return request(server())
      .post('/api/pricing/profiles')
      .set('Cookie', identity.cookie)
      .send({ name: `Perfil ${label}`, deductions: deductions() })
      .expect(201)
      .then((response) => response.body);
  }

  beforeAll(async () => {
    const url = process.env.DATABASE_URL;
    const expected = process.env.PRICING_CONFIGURATION_E2E_DATABASE;
    const normal = process.env.PRICING_CONFIGURATION_E2E_NORMAL_DATABASE;
    if (
      process.env.PRICING_CONFIGURATION_E2E_DISPOSABLE !== 'YES' ||
      !url ||
      !expected ||
      !normal
    )
      throw new Error(
        'Pricing profiles E2E requires its disposable PostgreSQL runner.',
      );
    const resolved = new URL(url).pathname.slice(1);
    if (
      resolved !== expected ||
      resolved === normal ||
      !/^pricing_configuration_e2e_[a-f0-9]{16}$/.test(resolved)
    )
      throw new Error(
        `Refusing non-disposable pricing profiles database: ${resolved}`,
      );
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    primary = await register('primary');
    foreign = await register('foreign');
  });

  it('enforces authentication and validates protected, textual and decimal fields', async () => {
    const profilesBefore = await prisma.pricingSalesProfile.count({
      where: { organizationId: primary.organizationId },
    });
    const auditsBefore = await prisma.auditLog.count({
      where: {
        organizationId: primary.organizationId,
        entityType: 'pricing_sales_profile',
      },
    });
    await request(server()).get('/api/pricing/profiles').expect(401);
    for (const payload of [
      { name: '  ', deductions: [] },
      { name: 'Valid', organizationId: foreign.organizationId, deductions: [] },
      { name: 'Valid', deductions: [{ ...deductions()[0], rate: 1 }] },
      { name: 'Valid', deductions: [{ ...deductions()[0], rate: '1e-2' }] },
      { name: 'Valid', deductions: [{ ...deductions()[0], rate: '-0.1' }] },
      {
        name: 'Valid',
        deductions: [{ ...deductions()[0], confirmedByUserId: primary.userId }],
      },
      {
        name: 'Valid',
        deductions: [
          {
            ...deductions()[0],
            originDetails: { confirmedByUserId: primary.userId },
          },
        ],
      },
      {
        name: 'Valid',
        deductions: [{ name: 'Sem taxa', category: 'CARD', origin: 'MANUAL' }],
      },
      { name: 'Valid', deductions: [{ ...deductions()[0], rate: null }] },
      { name: 'Valid', deductions: null },
      {
        name: 'Valid',
        deductions: [{ ...deductions()[0], originDetails: [] }],
      },
    ]) {
      const response = await request(server())
        .post('/api/pricing/profiles')
        .set('Cookie', primary.cookie)
        .send(payload)
        .expect(400);
      expect([
        'VALIDATION_ERROR',
        'INVALID_DECIMAL_VALUE',
        'NEGATIVE_VALUE',
      ]).toContain(response.body.code);
    }
    expect(
      await prisma.pricingSalesProfile.count({
        where: { organizationId: primary.organizationId },
      }),
    ).toBe(profilesBefore);
    expect(
      await prisma.auditLog.count({
        where: {
          organizationId: primary.organizationId,
          entityType: 'pricing_sales_profile',
        },
      }),
    ).toBe(auditsBefore);
  });

  it('rejects null update fields without creating revisions or audit records', async () => {
    const created = await createProfile('invalid-null-update');
    const revisionsBefore = await prisma.pricingSalesProfileRevision.count({
      where: { profileId: created.id },
    });
    const auditsBefore = await prisma.auditLog.count({
      where: { entityId: created.id },
    });

    for (const payload of [
      { expectedRevision: 1, deductions: null },
      { expectedRevision: 1, name: null },
    ]) {
      const response = await request(server())
        .patch(`/api/pricing/profiles/${created.id}`)
        .set('Cookie', primary.cookie)
        .send(payload)
        .expect(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    }

    expect(
      await prisma.pricingSalesProfileRevision.count({
        where: { profileId: created.id },
      }),
    ).toBe(revisionsBefore);
    expect(
      await prisma.auditLog.count({ where: { entityId: created.id } }),
    ).toBe(auditsBefore);
  });

  it('creates, lists and details only current revisions with ordered string rates', async () => {
    const created = await createProfile('ordered');
    expect(
      created.currentRevision.deductions.map(
        (item: { position: number }) => item.position,
      ),
    ).toEqual([1, 2]);
    expect(created.currentRevision.deductions[0]).toMatchObject({
      rate: '0.025',
      originDetails: { confirmedByUserId: primary.userId },
    });
    const detail = await request(server())
      .get(`/api/pricing/profiles/${created.id}`)
      .set('Cookie', primary.cookie)
      .expect(200);
    expect(
      detail.body.currentRevision.deductions.map(
        (item: { rate: unknown }) => typeof item.rate,
      ),
    ).toEqual(['string', 'string']);
    const list = await request(server())
      .get('/api/pricing/profiles')
      .query({ page: 1, pageSize: 1, isActive: true })
      .set('Cookie', primary.cookie)
      .expect(200);
    expect(list.body).toMatchObject({ pagination: { page: 1, pageSize: 1 } });
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].currentRevision).not.toHaveProperty('deductions');
  });

  it('allows an empty deduction collection and extensible categories', async () => {
    const response = await request(server())
      .post('/api/pricing/profiles')
      .set('Cookie', primary.cookie)
      .send({ name: 'Sem deduções', deductions: [] })
      .expect(201);
    expect(response.body.currentRevision.deductions).toEqual([]);
  });

  it('creates immutable revisions, preserves omitted fields and replaces deductions completely', async () => {
    const created = await createProfile('update');
    const updated = await request(server())
      .patch(`/api/pricing/profiles/${created.id}`)
      .set('Cookie', primary.cookie)
      .send({
        expectedRevision: 1,
        deductions: [
          {
            name: 'Imposto',
            category: 'TAX',
            rate: '0.15000000',
            origin: 'MANUAL',
          },
        ],
      })
      .expect(200);
    expect(updated.body.currentRevision).toMatchObject({
      revision: 2,
      name: created.currentRevision.name,
    });
    expect(updated.body.currentRevision.deductions).toHaveLength(1);
    const historical =
      await prisma.pricingSalesProfileRevision.findFirstOrThrow({
        where: { profileId: created.id, revision: 1 },
        include: { deductions: true },
      });
    expect(historical.deductions).toHaveLength(2);
  });

  it('returns canonical and identical updates as no-op but rejects stale revisions', async () => {
    const created = await createProfile('noop');
    const beforeAudits = await prisma.auditLog.count({
      where: { entityId: created.id },
    });
    const noOp = await request(server())
      .patch(`/api/pricing/profiles/${created.id}`)
      .set('Cookie', primary.cookie)
      .send({ expectedRevision: 1, deductions: deductions() })
      .expect(200);
    expect(noOp.body.currentRevision.id).toBe(created.currentRevision.id);
    expect(
      await prisma.pricingSalesProfileRevision.count({
        where: { profileId: created.id },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({ where: { entityId: created.id } }),
    ).toBe(beforeAudits);
    const stale = await request(server())
      .patch(`/api/pricing/profiles/${created.id}`)
      .set('Cookie', primary.cookie)
      .send({ expectedRevision: 2, name: 'Outro' })
      .expect(409);
    expect(stale.body.code).toBe('PRICING_REVISION_CONFLICT');
  });

  it('round-trips the smallest deduction rate without exponent or a new revision', async () => {
    const deduction = {
      name: 'Taxa mínima',
      category: 'TINY',
      rate: '0.00000001',
      origin: 'MANUAL',
    };
    const created = await request(server())
      .post('/api/pricing/profiles')
      .set('Cookie', primary.cookie)
      .send({ name: `Tiny ${randomUUID()}`, deductions: [deduction] })
      .expect(201);
    expect(created.body.currentRevision.deductions[0].rate).toBe('0.00000001');
    expect(JSON.stringify(created.body)).not.toMatch(/[eE]-8/);

    const persisted = await prisma.pricingDeduction.findFirstOrThrow({
      where: {
        organizationId: primary.organizationId,
        profileRevisionId: created.body.currentRevision.id,
      },
    });
    expect(persisted.rate.toFixed()).toBe('0.00000001');

    const read = await request(server())
      .get(`/api/pricing/profiles/${created.body.id}`)
      .set('Cookie', primary.cookie)
      .expect(200);
    expect(read.body.currentRevision.deductions[0].rate).toBe('0.00000001');
    const auditsBefore = await prisma.auditLog.count({
      where: { entityId: created.body.id },
    });
    const resent = await request(server())
      .patch(`/api/pricing/profiles/${created.body.id}`)
      .set('Cookie', primary.cookie)
      .send({
        expectedRevision: read.body.currentRevision.revision,
        deductions: [
          {
            ...deduction,
            rate: read.body.currentRevision.deductions[0].rate,
          },
        ],
      })
      .expect(200);
    expect(resent.body.currentRevision.id).toBe(read.body.currentRevision.id);
    expect(
      await prisma.pricingSalesProfileRevision.count({
        where: { profileId: created.body.id },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({ where: { entityId: created.body.id } }),
    ).toBe(auditsBefore);
  });

  it('isolates organizations and makes foreign resources indistinguishable', async () => {
    const created = await createProfile('foreign', foreign);
    const missing = randomUUID();
    const [foreignDetail, absentDetail] = await Promise.all([
      request(server())
        .get(`/api/pricing/profiles/${created.id}`)
        .set('Cookie', primary.cookie),
      request(server())
        .get(`/api/pricing/profiles/${missing}`)
        .set('Cookie', primary.cookie),
    ]);
    expect(foreignDetail.status).toBe(404);
    expect(foreignDetail.body).toEqual(absentDetail.body);
    const [foreignUpdate, absentUpdate] = await Promise.all([
      request(server())
        .patch(`/api/pricing/profiles/${created.id}`)
        .set('Cookie', primary.cookie)
        .send({ expectedRevision: 1, name: 'Blocked' }),
      request(server())
        .patch(`/api/pricing/profiles/${missing}`)
        .set('Cookie', primary.cookie)
        .send({ expectedRevision: 1, name: 'Blocked' }),
    ]);
    expect(foreignUpdate.status).toBe(404);
    expect(foreignUpdate.body).toEqual(absentUpdate.body);
    expect(
      (
        await request(server())
          .get('/api/pricing/profiles')
          .set('Cookie', primary.cookie)
      ).body.data.some((item: { id: string }) => item.id === created.id),
    ).toBe(false);
  });

  it('deactivates without deleting history and repeated deactivation is idempotent', async () => {
    const created = await createProfile('deactivate');
    const first = await request(server())
      .post(`/api/pricing/profiles/${created.id}/deactivate`)
      .set('Cookie', primary.cookie)
      .send({ expectedRevision: 1 })
      .expect(200);
    expect(first.body.isActive).toBe(false);
    await request(server())
      .post(`/api/pricing/profiles/${created.id}/deactivate`)
      .set('Cookie', primary.cookie)
      .send({ expectedRevision: 1 })
      .expect(200);
    expect(
      await prisma.auditLog.count({
        where: {
          entityId: created.id,
          action: 'pricing_sales_profile.deactivated',
        },
      }),
    ).toBe(1);
    const inactive = await request(server())
      .patch(`/api/pricing/profiles/${created.id}`)
      .set('Cookie', primary.cookie)
      .send({ expectedRevision: 1, name: 'Bloqueado' })
      .expect(409);
    expect(inactive.body.code).toBe('PRICING_PROFILE_INACTIVE');
    const inactiveList = await request(server())
      .get('/api/pricing/profiles')
      .query({ isActive: false })
      .set('Cookie', primary.cookie)
      .expect(200);
    expect(
      inactiveList.body.data.some(
        (item: { id: string }) => item.id === created.id,
      ),
    ).toBe(true);
  });

  it('enforces the complete role matrix', async () => {
    const profiles = await Promise.all(
      Object.values(OrganizationRole).map((role) =>
        createProfile(`roles-${role}`),
      ),
    );
    const membership = {
      organizationId_userId: {
        organizationId: primary.organizationId,
        userId: primary.userId,
      },
    };
    try {
      for (const [index, role] of Object.values(OrganizationRole).entries()) {
        const profile = profiles[index]!;
        await prisma.organizationMember.update({
          where: membership,
          data: { role },
        });
        const get = await request(server())
          .get(`/api/pricing/profiles/${profile.id}`)
          .set('Cookie', primary.cookie);
        expect(get.status).toBe(role === OrganizationRole.VIEWER ? 403 : 200);
        const post = await request(server())
          .post('/api/pricing/profiles')
          .set('Cookie', primary.cookie)
          .send({ name: `Role ${role}`, deductions: [] });
        expect(post.status).toBe(
          role === OrganizationRole.OWNER || role === OrganizationRole.ADMIN
            ? 201
            : 403,
        );
        const canWrite =
          role === OrganizationRole.OWNER || role === OrganizationRole.ADMIN;
        const patch = await request(server())
          .patch(`/api/pricing/profiles/${profile.id}`)
          .set('Cookie', primary.cookie)
          .send({ expectedRevision: 1, name: `Changed ${role}` });
        expect(patch.status).toBe(canWrite ? 200 : 403);
        const deactivate = await request(server())
          .post(`/api/pricing/profiles/${profile.id}/deactivate`)
          .set('Cookie', primary.cookie)
          .send({ expectedRevision: canWrite ? 2 : 1 });
        expect(deactivate.status).toBe(canWrite ? 200 : 403);
      }
    } finally {
      await prisma.organizationMember.update({
        where: membership,
        data: { role: OrganizationRole.OWNER },
      });
    }
  });

  it('serializes two updates so exactly one revision and audit win', async () => {
    const created = await createProfile('concurrent-update');
    const responses = await Promise.all(
      ['A', 'B'].map((name) =>
        request(server())
          .patch(`/api/pricing/profiles/${created.id}`)
          .set('Cookie', primary.cookie)
          .send({ expectedRevision: 1, name }),
      ),
    );
    expect(responses.map((item) => item.status).sort()).toEqual([200, 409]);
    expect(
      await prisma.pricingSalesProfileRevision.count({
        where: { profileId: created.id },
      }),
    ).toBe(2);
    expect(
      await prisma.auditLog.count({
        where: {
          entityId: created.id,
          action: 'pricing_sales_profile.updated',
        },
      }),
    ).toBe(1);
    const current = await prisma.pricingSalesProfile.findUniqueOrThrow({
      where: { id: created.id },
      include: { currentRevision: { include: { deductions: true } } },
    });
    expect(
      current.currentRevision?.deductions.map((item) => item.position),
    ).toEqual([1, 2]);
  });

  it('serializes update against deactivation without orphan revisions or loser audit', async () => {
    const created = await createProfile('concurrent-deactivate');
    const responses = await Promise.all([
      request(server())
        .patch(`/api/pricing/profiles/${created.id}`)
        .set('Cookie', primary.cookie)
        .send({ expectedRevision: 1, name: 'Updated' }),
      request(server())
        .post(`/api/pricing/profiles/${created.id}/deactivate`)
        .set('Cookie', primary.cookie)
        .send({ expectedRevision: 1 }),
    ]);
    expect(responses.filter((item) => item.status === 200)).toHaveLength(1);
    expect(responses.filter((item) => item.status === 409)).toHaveLength(1);
    const root = await prisma.pricingSalesProfile.findUniqueOrThrow({
      where: { id: created.id },
      include: { currentRevision: true, revisions: true },
    });
    expect(root.currentRevision).not.toBeNull();
    expect(
      root.revisions.some((revision) => revision.id === root.currentRevisionId),
    ).toBe(true);
    expect(
      await prisma.auditLog.count({ where: { entityId: created.id } }),
    ).toBe(root.revisions.length + (root.isActive ? 0 : 1));
  });

  afterAll(async () => {
    await app?.close();
  });
});
