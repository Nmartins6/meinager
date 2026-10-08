import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { vi } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/database/prisma.service.js';
import {
  OrganizationRole,
  ProductType,
} from '../src/generated/prisma/enums.js';
import { PricingCompositionsService } from '../src/pricing/services/pricing-compositions.service.js';

interface Identity {
  cookie: string;
  organizationId: string;
  userId: string;
}

describe('Product pricing compositions (e2e)', () => {
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
        name: `Compositions ${label}`,
        email: `compositions.${label}.${suffix}@example.com`,
        password: 'senha-e2e-segura',
        organizationName: `Compositions ${label} ${suffix}`,
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

  async function createProduct(
    identity: Identity,
    label: string,
    options: {
      unit?: string;
      directCost?: string | null;
      isActive?: boolean;
    } = {},
  ) {
    const name = `Product ${label} ${randomUUID()}`;
    return prisma.product.create({
      data: {
        organizationId: identity.organizationId,
        type: ProductType.PRODUCT,
        name,
        normalizedName: name.toLowerCase(),
        unit: options.unit ?? 'UN',
        directCost:
          options.directCost === undefined ? '10' : options.directCost,
        isActive: options.isActive ?? true,
      },
    });
  }

  async function createProfile(identity: Identity, label: string) {
    return request(server())
      .post('/api/pricing/profiles')
      .set('Cookie', identity.cookie)
      .send({ name: `Profile ${label}`, deductions: [] })
      .expect(201)
      .then((response) => response.body);
  }

  function payload(
    expectedRevision: number | null,
    options: { profileId?: string | null; sourceProductId?: string } = {},
  ) {
    return {
      expectedRevision,
      profileId: options.profileId ?? null,
      desiredMargin: '0.25000000',
      laborEnabled: true,
      timeMinutes: '90.000000',
      freightMode: 'MANUAL',
      freightUnitCost: '3.000000',
      freightTotalCost: null,
      freightQuantity: null,
      freightConsumedQuantity: null,
      parameterOrigins: {
        desiredMargin: { origin: 'MANUAL' },
        laborEnabled: { origin: 'MANUAL' },
        timeMinutes: { origin: 'MANUAL' },
        freightMode: { origin: 'MANUAL' },
        freightUnitCost: { origin: 'MANUAL' },
      },
      components: [
        {
          description: 'Manual material',
          category: 'MATERIAL',
          unit: 'UN',
          quantity: '2.000000',
          costSource: 'MANUAL',
          storedUnitCost: '12.500000',
        },
        {
          description: 'Copied package',
          category: 'PACKAGING',
          unit: 'UN',
          quantity: '1',
          costSource: 'COPIED',
          storedUnitCost: '2.25',
          originDetails: { source: 'previous-composition' },
        },
        ...(options.sourceProductId
          ? [
              {
                description: 'Catalog input',
                category: 'DIRECT_COST',
                unit: 'KG',
                quantity: '3',
                costSource: 'CATALOG',
                sourceProductId: options.sourceProductId,
              },
            ]
          : []),
      ],
    };
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
    ) {
      throw new Error(
        'Pricing compositions E2E requires its disposable PostgreSQL runner.',
      );
    }
    const resolved = new URL(url).pathname.slice(1);
    if (
      resolved !== expected ||
      resolved === normal ||
      !/^pricing_configuration_e2e_[a-f0-9]{16}$/.test(resolved)
    ) {
      throw new Error(
        `Refusing non-disposable pricing compositions database: ${resolved}`,
      );
    }
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

  it('requires authentication and distinguishes an absent composition from an absent product', async () => {
    const product = await createProduct(primary, 'authentication');
    await request(server())
      .get(`/api/pricing/products/${product.id}/composition`)
      .expect(401);
    await request(server())
      .put(`/api/pricing/products/${product.id}/composition`)
      .send(payload(null))
      .expect(401);

    const absentComposition = await request(server())
      .get(`/api/pricing/products/${product.id}/composition`)
      .set('Cookie', primary.cookie)
      .expect(404);
    expect(absentComposition.body.code).toBe('PRICING_COMPOSITION_NOT_FOUND');
    const absentProduct = await request(server())
      .get(`/api/pricing/products/${randomUUID()}/composition`)
      .set('Cookie', primary.cookie)
      .expect(404);
    expect(absentProduct.body.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('creates and reads an ordered composition with MANUAL, COPIED and CATALOG components', async () => {
    const target = await createProduct(primary, 'complete');
    const source = await createProduct(primary, 'catalog', {
      unit: 'KG',
      directCost: '9.750000',
    });
    const profile = await createProfile(primary, 'selected');
    const [stockBefore, entriesBefore] = await Promise.all([
      prisma.stockMovement.count({
        where: { organizationId: primary.organizationId },
      }),
      prisma.financialEntry.count({
        where: { organizationId: primary.organizationId },
      }),
    ]);

    const created = await request(server())
      .put(`/api/pricing/products/${target.id}/composition`)
      .set('Cookie', primary.cookie)
      .send(
        payload(null, { profileId: profile.id, sourceProductId: source.id }),
      )
      .expect(200);

    expect(created.body).toMatchObject({
      productId: target.id,
      revision: 1,
      profileId: profile.id,
      desiredMargin: '0.25',
      timeMinutes: '90',
      freightUnitCost: '3',
    });
    expect(
      created.body.components.map(
        (item: { position: number }) => item.position,
      ),
    ).toEqual([1, 2, 3]);
    expect(created.body.components[0]).toMatchObject({
      costSource: 'MANUAL',
      storedUnitCost: '12.5',
      sourceProductId: null,
    });
    expect(created.body.components[1]).toMatchObject({
      costSource: 'COPIED',
      originDetails: {
        source: 'previous-composition',
        confirmedByUserId: primary.userId,
      },
    });
    expect(created.body.components[2]).toMatchObject({
      costSource: 'CATALOG',
      storedUnitCost: null,
      sourceProductId: source.id,
    });
    expect(created.body.parameterOrigins.desiredMargin).toMatchObject({
      origin: 'MANUAL',
      confirmedByUserId: primary.userId,
    });

    const detail = await request(server())
      .get(`/api/pricing/products/${target.id}/composition`)
      .set('Cookie', primary.cookie)
      .expect(200);
    expect(detail.body).toEqual(created.body);
    expect(
      await prisma.auditLog.count({
        where: {
          entityId: created.body.id,
          action: 'product_pricing_composition.updated',
        },
      }),
    ).toBe(1);
    expect(
      await prisma.stockMovement.count({
        where: { organizationId: primary.organizationId },
      }),
    ).toBe(stockBefore);
    expect(
      await prisma.financialEntry.count({
        where: { organizationId: primary.organizationId },
      }),
    ).toBe(entriesBefore);
  });

  it('accepts every persisted component category and derives contiguous positions', async () => {
    const target = await createProduct(primary, 'categories');
    const categories = [
      'DIRECT_COST',
      'MATERIAL',
      'PACKAGING',
      'LABOR',
      'FREIGHT',
      'OUTSOURCING',
      'LOSS',
      'OTHER',
    ];
    const input = payload(null);
    input.components = categories.map((category, index) => ({
      description: `Component ${category}`,
      category,
      unit: 'UN',
      quantity: '1',
      costSource: 'MANUAL',
      storedUnitCost: `${index + 1}`,
    }));
    const response = await request(server())
      .put(`/api/pricing/products/${target.id}/composition`)
      .set('Cookie', primary.cookie)
      .send(input)
      .expect(200);
    expect(
      response.body.components.map(
        (component: { category: string }) => component.category,
      ),
    ).toEqual(categories);
    expect(
      response.body.components.map(
        (component: { position: number }) => component.position,
      ),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('replaces all components, increments once and accepts an empty collection', async () => {
    const target = await createProduct(primary, 'replacement');
    await request(server())
      .put(`/api/pricing/products/${target.id}/composition`)
      .set('Cookie', primary.cookie)
      .send(payload(null))
      .expect(200);
    const initialReplacement = payload(1);
    const { timeMinutes: _timeOrigin, ...replacementOrigins } =
      initialReplacement.parameterOrigins;
    const replacement = {
      ...initialReplacement,
      components: [],
      laborEnabled: false,
      timeMinutes: null,
      parameterOrigins: replacementOrigins,
    };

    const updated = await request(server())
      .put(`/api/pricing/products/${target.id}/composition`)
      .set('Cookie', primary.cookie)
      .send(replacement)
      .expect(200);
    expect(updated.body.revision).toBe(2);
    expect(updated.body.components).toEqual([]);
    expect(
      await prisma.auditLog.count({
        where: {
          entityId: updated.body.id,
          action: 'product_pricing_composition.updated',
        },
      }),
    ).toBe(2);
  });

  it('returns equivalent and identical payloads as no-op after validating the revision', async () => {
    const target = await createProduct(primary, 'noop');
    const created = await request(server())
      .put(`/api/pricing/products/${target.id}/composition`)
      .set('Cookie', primary.cookie)
      .send(payload(null))
      .expect(200);
    const equivalent = payload(1);
    equivalent.desiredMargin = '0.25000000';
    equivalent.components[0]!.quantity = '2.000000';
    const response = await request(server())
      .put(`/api/pricing/products/${target.id}/composition`)
      .set('Cookie', primary.cookie)
      .send(equivalent)
      .expect(200);
    expect(response.body.id).toBe(created.body.id);
    expect(response.body.revision).toBe(1);
    expect(
      await prisma.auditLog.count({ where: { entityId: created.body.id } }),
    ).toBe(1);

    const stale = await request(server())
      .put(`/api/pricing/products/${target.id}/composition`)
      .set('Cookie', primary.cookie)
      .send(payload(2))
      .expect(409);
    expect(stale.body.code).toBe('PRICING_REVISION_CONFLICT');
    const persisted = await prisma.productPricingComposition.findUniqueOrThrow({
      where: {
        organizationId_productId: {
          organizationId: primary.organizationId,
          productId: target.id,
        },
      },
      include: { components: { orderBy: { position: 'asc' } } },
    });
    expect(persisted.revision).toBe(1);
    expect(persisted.components).toHaveLength(2);
    expect(
      await prisma.auditLog.count({ where: { entityId: created.body.id } }),
    ).toBe(1);
  });

  it('round-trips the smallest margin without exponent or a new revision', async () => {
    const target = await createProduct(primary, 'plain-decimal');
    const input = payload(null);
    input.desiredMargin = '0.00000001';
    const created = await request(server())
      .put(`/api/pricing/products/${target.id}/composition`)
      .set('Cookie', primary.cookie)
      .send(input)
      .expect(200);
    expect(created.body.desiredMargin).toBe('0.00000001');
    expect(created.body.desiredMargin).not.toMatch(/[eE]/);

    const persisted = await prisma.productPricingComposition.findFirstOrThrow({
      where: {
        organizationId: primary.organizationId,
        productId: target.id,
      },
    });
    expect(persisted.desiredMargin?.toFixed()).toBe('0.00000001');

    const read = await request(server())
      .get(`/api/pricing/products/${target.id}/composition`)
      .set('Cookie', primary.cookie)
      .expect(200);
    expect(read.body.desiredMargin).toBe('0.00000001');
    const auditsBefore = await prisma.auditLog.count({
      where: { entityId: created.body.id },
    });
    const resend = payload(read.body.revision);
    resend.desiredMargin = read.body.desiredMargin;
    const resent = await request(server())
      .put(`/api/pricing/products/${target.id}/composition`)
      .set('Cookie', primary.cookie)
      .send(resend)
      .expect(200);
    expect(resent.body.revision).toBe(1);
    expect(resent.body.desiredMargin).toBe('0.00000001');
    expect(
      await prisma.auditLog.count({ where: { entityId: created.body.id } }),
    ).toBe(auditsBefore);
  });

  it('rolls back composition and audit together when the audit write fails', async () => {
    const target = await createProduct(primary, 'rollback');
    const compositions = app.get(PricingCompositionsService) as unknown as {
      audit: (...args: unknown[]) => Promise<unknown>;
    };
    const audit = vi
      .spyOn(compositions, 'audit')
      .mockRejectedValueOnce(new Error('forced audit failure'));
    try {
      const response = await request(server())
        .put(`/api/pricing/products/${target.id}/composition`)
        .set('Cookie', primary.cookie)
        .send(payload(null))
        .expect(500);
      expect(response.body.code).toBe('INTERNAL_ERROR');
    } finally {
      audit.mockRestore();
    }
    expect(
      await prisma.productPricingComposition.count({
        where: {
          organizationId: primary.organizationId,
          productId: target.id,
        },
      }),
    ).toBe(0);
    expect(
      await prisma.auditLog.count({
        where: {
          organizationId: primary.organizationId,
          entityType: 'product_pricing_composition',
          metadata: { path: ['productId'], equals: target.id },
        },
      }),
    ).toBe(0);
  });

  it('rejects malformed and protected payloads without persistence or audit', async () => {
    const target = await createProduct(primary, 'invalid');
    const withoutComponents: Partial<ReturnType<typeof payload>> =
      payload(null);
    delete withoutComponents.components;
    const auditsBefore = await prisma.auditLog.count({
      where: {
        organizationId: primary.organizationId,
        entityType: 'product_pricing_composition',
      },
    });
    const invalidPayloads = [
      withoutComponents,
      { ...payload(null), organizationId: foreign.organizationId },
      { ...payload(null), actorUserId: foreign.userId },
      { ...payload(null), components: null },
      { ...payload(null), parameterOrigins: [] },
      { ...payload(null), desiredMargin: 0.25 },
      { ...payload(null), desiredMargin: '1e-2' },
      { ...payload(null), desiredMargin: 'NaN' },
      { ...payload(null), desiredMargin: 'Infinity' },
      { ...payload(null), desiredMargin: '+0.25' },
      { ...payload(null), desiredMargin: '-0.1' },
      { ...payload(null), desiredMargin: '10000.00000000' },
      { ...payload(null), laborEnabled: true, timeMinutes: null },
      { ...payload(null), components: [[]] },
      {
        ...payload(null),
        components: [{ ...payload(null).components[0], description: '  ' }],
      },
      {
        ...payload(null),
        components: [{ ...payload(null).components[0], quantity: null }],
      },
      {
        ...payload(null),
        components: [{ ...payload(null).components[0], quantity: 2 }],
      },
      {
        ...payload(null),
        components: [{ ...payload(null).components[0], quantity: '1e2' }],
      },
      {
        ...payload(null),
        components: [{ ...payload(null).components[0], quantity: '-1' }],
      },
      {
        ...payload(null),
        components: [{ ...payload(null).components[0], storedUnitCost: 12.5 }],
      },
      {
        ...payload(null),
        components: [{ ...payload(null).components[0], storedUnitCost: '1e2' }],
      },
      {
        ...payload(null),
        components: [{ ...payload(null).components[0], storedUnitCost: 'NaN' }],
      },
      {
        ...payload(null),
        components: [
          { ...payload(null).components[0], storedUnitCost: 'Infinity' },
        ],
      },
      {
        ...payload(null),
        components: [
          { ...payload(null).components[0], storedUnitCost: '+12.5' },
        ],
      },
      {
        ...payload(null),
        components: [{ ...payload(null).components[0], storedUnitCost: '-1' }],
      },
      {
        ...payload(null),
        components: [
          {
            ...payload(null).components[0],
            storedUnitCost: '1.1234567',
          },
        ],
      },
      {
        ...payload(null),
        components: [{ ...payload(null).components[0], originDetails: [] }],
      },
      {
        ...payload(null),
        components: [{ ...payload(null).components[0], position: 9 }],
      },
    ];

    for (const invalid of invalidPayloads) {
      const response = await request(server())
        .put(`/api/pricing/products/${target.id}/composition`)
        .set('Cookie', primary.cookie)
        .send(invalid)
        .expect(400);
      expect(response.body.code).not.toBe('INTERNAL_ERROR');
    }
    expect(
      await prisma.productPricingComposition.count({
        where: { productId: target.id },
      }),
    ).toBe(0);
    expect(
      await prisma.auditLog.count({
        where: {
          organizationId: primary.organizationId,
          entityType: 'product_pricing_composition',
        },
      }),
    ).toBe(auditsBefore);
  });

  it('rejects incompatible MANUAL, COPIED and CATALOG combinations', async () => {
    const target = await createProduct(primary, 'source-combinations');
    const source = await createProduct(primary, 'source-combinations-catalog', {
      unit: 'KG',
    });
    const cases = [
      {
        ...payload(null),
        components: [
          {
            ...payload(null).components[0],
            storedUnitCost: undefined,
          },
        ],
      },
      {
        ...payload(null),
        components: [
          {
            ...payload(null).components[0],
            sourceProductId: source.id,
          },
        ],
      },
      {
        ...payload(null),
        components: [
          {
            description: 'Catalog',
            category: 'MATERIAL',
            unit: 'KG',
            quantity: '1',
            costSource: 'CATALOG',
          },
        ],
      },
      {
        ...payload(null),
        components: [
          {
            description: 'Catalog',
            category: 'MATERIAL',
            unit: 'KG',
            quantity: '1',
            costSource: 'CATALOG',
            sourceProductId: source.id,
            storedUnitCost: null,
          },
        ],
      },
      {
        ...payload(null),
        components: [
          {
            description: 'Self',
            category: 'MATERIAL',
            unit: 'UN',
            quantity: '1',
            costSource: 'CATALOG',
            sourceProductId: target.id,
          },
        ],
      },
    ];
    for (const invalid of cases) {
      await request(server())
        .put(`/api/pricing/products/${target.id}/composition`)
        .set('Cookie', primary.cookie)
        .send(invalid)
        .expect(400);
    }
    expect(
      await prisma.productPricingComposition.count({
        where: { productId: target.id },
      }),
    ).toBe(0);
  });

  it('validates catalog ownership, activity, cost and unit without revealing foreign resources', async () => {
    const target = await createProduct(primary, 'catalog-validation');
    const foreignSource = await createProduct(foreign, 'foreign-source', {
      unit: 'KG',
    });
    const inactive = await createProduct(primary, 'inactive-source', {
      unit: 'KG',
      isActive: false,
    });
    const withoutCost = await createProduct(primary, 'no-cost-source', {
      unit: 'KG',
      directCost: null,
    });
    const wrongUnit = await createProduct(primary, 'wrong-unit-source', {
      unit: 'L',
    });
    const catalogPayload = (sourceProductId: string, unit = 'KG') => ({
      ...payload(null),
      components: [
        {
          description: 'Catalog',
          category: 'MATERIAL',
          unit,
          quantity: '1',
          costSource: 'CATALOG',
          sourceProductId,
        },
      ],
    });

    const foreignResponse = await request(server())
      .put(`/api/pricing/products/${target.id}/composition`)
      .set('Cookie', primary.cookie)
      .send(catalogPayload(foreignSource.id))
      .expect(404);
    const missingResponse = await request(server())
      .put(`/api/pricing/products/${target.id}/composition`)
      .set('Cookie', primary.cookie)
      .send(catalogPayload(randomUUID()))
      .expect(404);
    expect(foreignResponse.body).toEqual(missingResponse.body);

    for (const invalid of [
      catalogPayload(inactive.id),
      catalogPayload(withoutCost.id),
      catalogPayload(wrongUnit.id),
    ]) {
      await request(server())
        .put(`/api/pricing/products/${target.id}/composition`)
        .set('Cookie', primary.cookie)
        .send(invalid)
        .expect(400);
    }
  });

  it('validates selected profiles from the same organization and rejects inactive profiles', async () => {
    const target = await createProduct(primary, 'profile-validation');
    const foreignProfile = await createProfile(foreign, 'foreign');
    const activeProfile = await createProfile(primary, 'inactive');
    await request(server())
      .post(`/api/pricing/profiles/${activeProfile.id}/deactivate`)
      .set('Cookie', primary.cookie)
      .send({ expectedRevision: 1 })
      .expect(200);

    const foreignResponse = await request(server())
      .put(`/api/pricing/products/${target.id}/composition`)
      .set('Cookie', primary.cookie)
      .send(payload(null, { profileId: foreignProfile.id }))
      .expect(404);
    const missingResponse = await request(server())
      .put(`/api/pricing/products/${target.id}/composition`)
      .set('Cookie', primary.cookie)
      .send(payload(null, { profileId: randomUUID() }))
      .expect(404);
    expect(foreignResponse.body).toEqual(missingResponse.body);

    const inactiveResponse = await request(server())
      .put(`/api/pricing/products/${target.id}/composition`)
      .set('Cookie', primary.cookie)
      .send(payload(null, { profileId: activeProfile.id }))
      .expect(409);
    expect(inactiveResponse.body.code).toBe('PRICING_PROFILE_INACTIVE');
  });

  it('isolates product compositions across organizations', async () => {
    const foreignProduct = await createProduct(foreign, 'isolated');
    await request(server())
      .put(`/api/pricing/products/${foreignProduct.id}/composition`)
      .set('Cookie', foreign.cookie)
      .send(payload(null))
      .expect(200);

    const foreignGet = await request(server())
      .get(`/api/pricing/products/${foreignProduct.id}/composition`)
      .set('Cookie', primary.cookie);
    const absentGet = await request(server())
      .get(`/api/pricing/products/${randomUUID()}/composition`)
      .set('Cookie', primary.cookie);
    expect(foreignGet.status).toBe(404);
    expect(foreignGet.body).toEqual(absentGet.body);

    const foreignPut = await request(server())
      .put(`/api/pricing/products/${foreignProduct.id}/composition`)
      .set('Cookie', primary.cookie)
      .send(payload(1));
    const absentPut = await request(server())
      .put(`/api/pricing/products/${randomUUID()}/composition`)
      .set('Cookie', primary.cookie)
      .send(payload(1));
    expect(foreignPut.status).toBe(404);
    expect(foreignPut.body).toEqual(absentPut.body);
  });

  it('enforces read and write permissions for every organization role', async () => {
    const target = await createProduct(primary, 'roles');
    const created = await request(server())
      .put(`/api/pricing/products/${target.id}/composition`)
      .set('Cookie', primary.cookie)
      .send(payload(null))
      .expect(200);
    let revision = created.body.revision as number;
    const membership = {
      organizationId_userId: {
        organizationId: primary.organizationId,
        userId: primary.userId,
      },
    };
    try {
      for (const role of Object.values(OrganizationRole)) {
        await prisma.organizationMember.update({
          where: membership,
          data: { role },
        });
        const read = await request(server())
          .get(`/api/pricing/products/${target.id}/composition`)
          .set('Cookie', primary.cookie);
        expect(read.status).toBe(role === OrganizationRole.VIEWER ? 403 : 200);

        const writePayload = payload(revision);
        writePayload.desiredMargin = `0.${revision + 25}`;
        const write = await request(server())
          .put(`/api/pricing/products/${target.id}/composition`)
          .set('Cookie', primary.cookie)
          .send(writePayload);
        const canWrite =
          role === OrganizationRole.OWNER ||
          role === OrganizationRole.ADMIN ||
          role === OrganizationRole.OPERATIONS;
        expect(write.status).toBe(canWrite ? 200 : 403);
        if (canWrite) revision += 1;
      }
    } finally {
      await prisma.organizationMember.update({
        where: membership,
        data: { role: OrganizationRole.OWNER },
      });
    }
  });

  it('serializes concurrent replacements so exactly one revision and audit win', async () => {
    const target = await createProduct(primary, 'concurrent');
    const created = await request(server())
      .put(`/api/pricing/products/${target.id}/composition`)
      .set('Cookie', primary.cookie)
      .send(payload(null))
      .expect(200);
    const auditsBefore = await prisma.auditLog.count({
      where: { entityId: created.body.id },
    });
    const responses = await Promise.all(
      ['0.31', '0.32'].map((desiredMargin) => {
        const input = payload(1);
        input.desiredMargin = desiredMargin;
        return request(server())
          .put(`/api/pricing/products/${target.id}/composition`)
          .set('Cookie', primary.cookie)
          .send(input);
      }),
    );
    expect(responses.map((item) => item.status).sort()).toEqual([200, 409]);
    const current = await prisma.productPricingComposition.findUniqueOrThrow({
      where: {
        organizationId_productId: {
          organizationId: primary.organizationId,
          productId: target.id,
        },
      },
      include: { components: true },
    });
    expect(current.revision).toBe(2);
    expect(current.components.map((item) => item.position)).toEqual([1, 2]);
    expect(
      await prisma.auditLog.count({ where: { entityId: created.body.id } }),
    ).toBe(auditsBefore + 1);
  });

  afterAll(async () => {
    await app?.close();
  });
});
