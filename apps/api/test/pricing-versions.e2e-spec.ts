import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { vi } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SessionService } from '../src/auth/session/session.service.js';
import { PrismaService } from '../src/database/prisma.service.js';
import {
  OrganizationRole,
  ProductType,
} from '../src/generated/prisma/enums.js';
import { PricingVersionsService } from '../src/pricing/services/pricing-versions.service.js';

interface Identity {
  cookie: string;
  organizationId: string;
  userId: string;
}

describe('Pricing calculation versions (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let owner: Identity;
  let admin: Identity;
  let operations: Identity;
  let finance: Identity;
  let viewer: Identity;
  let foreign: Identity;
  let noConfiguration: Identity;

  const server = () => app.getHttpServer();

  function assertDisposableDatabase(): void {
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
        'Pricing versions E2E requires its disposable PostgreSQL runner.',
      );
    }
    const resolved = new URL(url).pathname.slice(1);
    if (
      resolved !== expected ||
      resolved === normal ||
      !/^pricing_configuration_e2e_[a-f0-9]{16}$/.test(resolved)
    ) {
      throw new Error(
        `Refusing non-disposable pricing versions database: ${resolved}`,
      );
    }
  }

  async function register(label: string): Promise<Identity> {
    const suffix = randomUUID();
    const response = await request(server())
      .post('/api/auth/register')
      .send({
        name: `Simulations ${label}`,
        email: `sim.${suffix}@example.com`,
        password: 'senha-e2e-segura',
        organizationName: `Simulations ${label} ${suffix}`,
      });
    if (response.status !== 201) {
      throw new Error(
        `Pricing version identity registration failed: ${response.status} ${JSON.stringify(response.body)}`,
      );
    }
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

  async function identityWithRole(role: OrganizationRole): Promise<Identity> {
    const suffix = randomUUID();
    const user = await prisma.user.create({
      data: {
        name: `Simulation ${role}`,
        email: `simulation.${role.toLowerCase()}.${suffix}@example.com`,
        normalizedEmail: `simulation.${role.toLowerCase()}.${suffix}@example.com`,
        passwordHash: 'test-only',
        memberships: {
          create: { organizationId: owner.organizationId, role },
        },
      },
    });
    const session = await app.get(SessionService).create(user.id);
    return {
      cookie: `meinager_session=${session.token}`,
      organizationId: owner.organizationId,
      userId: user.id,
    };
  }

  async function createProduct(
    identity: Identity,
    label: string,
    options: {
      unit?: string;
      directCost?: string | null;
      isActive?: boolean;
      salePrice?: string | null;
    } = {},
  ) {
    const name = `Simulation ${label} ${randomUUID()}`;
    return prisma.product.create({
      data: {
        organizationId: identity.organizationId,
        type: ProductType.PRODUCT,
        name,
        normalizedName: name.toLowerCase(),
        unit: options.unit ?? 'UN',
        directCost:
          options.directCost === undefined ? '10' : options.directCost,
        salePrice: options.salePrice ?? null,
        isActive: options.isActive ?? true,
      },
    });
  }

  function configuration(expectedRevision: number | null) {
    return {
      expectedRevision,
      currency: 'BRL',
      fixedCostMode: 'RATE',
      fixedCostRate: '0.10',
      monthlyLaborCost: '3300',
      productiveHours: '165',
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

  async function createConfiguration(identity = owner) {
    return request(server())
      .patch('/api/pricing/configuration')
      .set('Cookie', identity.cookie)
      .send(configuration(null))
      .expect(200)
      .then((response) => response.body);
  }

  async function createProfile(
    deductions = [
      { name: 'Imposto', category: 'TAX', rate: '0.06', origin: 'MANUAL' },
      {
        name: 'Pagamento',
        category: 'PAYMENT',
        rate: '0.04',
        origin: 'MANUAL',
      },
    ],
    identity = owner,
  ) {
    return request(server())
      .post('/api/pricing/profiles')
      .set('Cookie', identity.cookie)
      .send({ name: `Profile ${randomUUID()}`, deductions })
      .expect(201)
      .then((response) => response.body);
  }

  function composition(profileId: string | null, sourceProductId?: string) {
    return {
      expectedRevision: null,
      profileId,
      desiredMargin: '0.25',
      laborEnabled: false,
      timeMinutes: null,
      freightMode: null,
      freightUnitCost: null,
      freightTotalCost: null,
      freightQuantity: null,
      freightConsumedQuantity: null,
      parameterOrigins: {
        desiredMargin: { origin: 'MANUAL' },
        laborEnabled: { origin: 'MANUAL' },
      },
      components: sourceProductId
        ? [
            {
              description: 'Catalog material',
              category: 'MATERIAL',
              unit: 'KG',
              quantity: '1',
              costSource: 'CATALOG',
              sourceProductId,
            },
          ]
        : [
            {
              description: 'Base cost',
              category: 'DIRECT_COST',
              unit: 'UN',
              quantity: '1',
              costSource: 'MANUAL',
              storedUnitCost: '50',
            },
          ],
    };
  }

  async function persistComposition(
    productId: string,
    payload: ReturnType<typeof composition>,
    identity = owner,
  ) {
    return request(server())
      .put(`/api/pricing/products/${productId}/composition`)
      .set('Cookie', identity.cookie)
      .send(payload)
      .expect(200)
      .then((response) => response.body);
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
    owner = await register('owner');
    [admin, operations, finance, viewer] = await Promise.all([
      identityWithRole(OrganizationRole.ADMIN),
      identityWithRole(OrganizationRole.OPERATIONS),
      identityWithRole(OrganizationRole.FINANCE),
      identityWithRole(OrganizationRole.VIEWER),
    ]);
    foreign = await register('foreign');
    noConfiguration = await register('no-configuration');
    await createConfiguration();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates finalized immutable versions with canonical snapshots, projections, audit and role enforcement', async () => {
    const product = await createProduct(owner, 'version-complete', {
      salePrice: '77.00',
    });
    const source = await createProduct(owner, 'version-catalog', {
      unit: 'KG',
      directCost: '0.000001',
    });
    const profile = await createProfile([
      {
        name: 'Tiny rate',
        category: 'TAX',
        rate: '0.00000001',
        origin: 'MANUAL',
      },
    ]);
    const persisted = await persistComposition(
      product.id,
      composition(profile.id, source.id),
    );
    const url = `/api/pricing/products/${product.id}/versions`;
    const before = await sideEffectCounts(owner.organizationId, product.id);

    await request(server())
      .post(url)
      .send({ expectedCompositionRevision: persisted.revision })
      .expect(401);
    for (const identity of [finance, viewer]) {
      const forbidden = await request(server())
        .post(url)
        .set('Cookie', identity.cookie)
        .send({ expectedCompositionRevision: persisted.revision })
        .expect(403);
      expect(forbidden.body.code).toBe('PRICING_FORBIDDEN');
    }

    const created = await request(server())
      .post(url)
      .set('Cookie', operations.cookie)
      .send({ expectedCompositionRevision: persisted.revision })
      .expect(201);
    expect(created.body).toMatchObject({
      productId: product.id,
      number: 1,
      state: 'FINALIZED',
      compositionRevision: persisted.revision,
      formulaVersion: 'margin-divisor-v1',
      snapshotSchemaVersion: 1,
      snapshot: {
        snapshotSchemaVersion: 1,
        formulaVersion: 'margin-divisor-v1',
        input: {
          adoptedPrice: null,
          labor: null,
          freight: null,
          components: [{ unitCost: '0.000001', productId: source.id }],
          deductions: [{ rate: '0.00000001' }],
        },
        context: {
          organizationId: owner.organizationId,
          product: { id: product.id },
          salesProfile: { id: profile.id },
        },
      },
    });
    expect(created.body.snapshot.input.fixedCosts.rate).toBe('0.1');
    expect(created.body.snapshot.input.deductions[0].rate).toBe('0.00000001');
    expect(created.body.components).toHaveLength(1);
    expect(created.body.deductions).toHaveLength(1);
    expect(created.body.components[0].effectiveUnitCost).toBe('0.000001');
    expect(created.body.deductions[0].rate).toBe('0.00000001');

    const after = await sideEffectCounts(owner.organizationId, product.id);
    expect(after).toMatchObject({
      versions: before.versions + 1,
      stockMovements: before.stockMovements,
      financialEntries: before.financialEntries,
      compositions: before.compositions,
      salePrice: before.salePrice,
      adoptedPricingVersionId: null,
    });
    expect(
      await prisma.auditLog.count({
        where: {
          organizationId: owner.organizationId,
          action: 'pricing_calculation_version.created',
          entityId: created.body.id,
        },
      }),
    ).toBe(1);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: created.body.id },
      select: { metadata: true },
    });
    expect(JSON.stringify(audit.metadata)).not.toContain('effectiveUnitCost');

    for (const identity of [owner, admin, operations, finance]) {
      await request(server())
        .get(url)
        .set('Cookie', identity.cookie)
        .expect(200);
      await request(server())
        .get(`${url}/${created.body.id}`)
        .set('Cookie', identity.cookie)
        .expect(200);
    }
    await request(server()).get(url).expect(401);
    await request(server()).get(`${url}/${created.body.id}`).expect(401);
    await request(server()).get(url).set('Cookie', viewer.cookie).expect(403);
    await request(server())
      .get(`${url}/${created.body.id}`)
      .set('Cookie', viewer.cookie)
      .expect(403);

    await expect(
      prisma.pricingCalculationVersion.update({
        where: { id: created.body.id },
        data: { analyzedPrice: '999' },
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.pricingVersionComponent.update({
        where: { id: created.body.components[0].id },
        data: { totalExact: '999' },
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.pricingVersionDeduction.update({
        where: { id: created.body.deductions[0].id },
        data: { amountExact: '999' },
      }),
    ).rejects.toBeDefined();

    const invalidVersionId = randomUUID();
    const invalidSnapshot = structuredClone(created.body.snapshot);
    invalidSnapshot.snapshotSchemaVersion = 2;
    await prisma.$transaction(async (transaction) => {
      await transaction.pricingCalculationVersion.create({
        data: {
          id: invalidVersionId,
          organizationId: owner.organizationId,
          productId: product.id,
          number: 2,
          compositionId: created.body.compositionId,
          compositionRevision: created.body.compositionRevision,
          configurationRevisionId: created.body.configurationRevisionId,
          profileRevisionId: created.body.profileRevisionId,
          snapshot: invalidSnapshot,
          minimumPriceCommercial: created.body.minimumPriceCommercial,
          suggestedPriceCommercial: created.body.suggestedPriceCommercial,
          analyzedPrice: created.body.analyzedPrice,
          classification: created.body.classification,
          componentCount: created.body.componentCount,
          deductionCount: created.body.deductionCount,
          formulaVersion: created.body.formulaVersion,
          snapshotSchemaVersion: 2,
          currency: created.body.currency,
          createdByUserId: owner.userId,
        },
      });
      await transaction.pricingVersionComponent.createMany({
        data: created.body.components.map((item: Record<string, unknown>) => ({
          organizationId: owner.organizationId,
          versionId: invalidVersionId,
          position: item.position as number,
          description: item.description as string,
          category: item.category as 'MATERIAL',
          unit: item.unit as string,
          quantity: item.quantity as string,
          effectiveUnitCost: item.effectiveUnitCost as string,
          totalExact: item.totalExact as string,
          totalDisplay: item.totalDisplay as string,
          sourceProductId: item.sourceProductId as string | null,
          costSource: item.costSource as 'CATALOG',
          originDetails: item.originDetails as Record<
            string,
            string | number | null
          >,
        })),
      });
      await transaction.pricingVersionDeduction.createMany({
        data: created.body.deductions.map((item: Record<string, unknown>) => ({
          organizationId: owner.organizationId,
          versionId: invalidVersionId,
          position: item.position as number,
          name: item.name as string,
          category: item.category as string,
          rate: item.rate as string,
          amountExact: item.amountExact as string,
          amountDisplay: item.amountDisplay as string,
          origin: item.origin as 'MANUAL',
          originDetails: item.originDetails as Record<
            string,
            string | number | null
          >,
        })),
      });
      await transaction.pricingCalculationVersion.update({
        where: { id: invalidVersionId },
        data: { state: 'FINALIZED', finalizedAt: new Date() },
      });
    });
    const invalidHistorical = await request(server())
      .get(`${url}/${invalidVersionId}`)
      .set('Cookie', owner.cookie)
      .expect(500);
    expect(invalidHistorical.body).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Não foi possível concluir a operação de precificação.',
    });
  });

  it('requires valid persisted dependencies and rejects protected version fields', async () => {
    const unconfigured = await createProduct(
      noConfiguration,
      'version-unconfigured',
    );
    const missingConfiguration = await request(server())
      .post(`/api/pricing/products/${unconfigured.id}/versions`)
      .set('Cookie', noConfiguration.cookie)
      .send({ expectedCompositionRevision: 1 })
      .expect(409);
    expect(missingConfiguration.body.code).toBe(
      'PRICING_CONFIGURATION_REQUIRED',
    );

    const withoutComposition = await createProduct(
      owner,
      'version-no-composition',
    );
    const missingComposition = await request(server())
      .post(`/api/pricing/products/${withoutComposition.id}/versions`)
      .set('Cookie', owner.cookie)
      .send({ expectedCompositionRevision: 1 })
      .expect(404);
    expect(missingComposition.body.code).toBe('PRICING_COMPOSITION_NOT_FOUND');

    const inactiveProduct = await createProduct(owner, 'version-inactive');
    const inactiveProfile = await createProfile([]);
    const inactiveComposition = await persistComposition(
      inactiveProduct.id,
      composition(inactiveProfile.id),
    );
    await request(server())
      .post(`/api/pricing/profiles/${inactiveProfile.id}/deactivate`)
      .set('Cookie', owner.cookie)
      .send({ expectedRevision: inactiveProfile.currentRevision.revision })
      .expect(200);
    const inactive = await request(server())
      .post(`/api/pricing/products/${inactiveProduct.id}/versions`)
      .set('Cookie', owner.cookie)
      .send({ expectedCompositionRevision: inactiveComposition.revision })
      .expect(409);
    expect(inactive.body.code).toBe('PRICING_PROFILE_INACTIVE');

    const protectedProduct = await createProduct(owner, 'version-protected');
    const protectedComposition = await persistComposition(
      protectedProduct.id,
      composition(null),
    );
    for (const protectedField of [
      { number: 2 },
      { organizationId: foreign.organizationId },
      { actorUserId: foreign.userId },
      { state: 'FINALIZED' },
      { formulaVersion: 'margin-divisor-v1' },
      { snapshot: {} },
      { classification: 'COST_COVERAGE' },
      { results: {} },
      { effectiveUnitCost: '1' },
      { createdAt: new Date().toISOString() },
      { id: randomUUID() },
    ]) {
      const response = await request(server())
        .post(`/api/pricing/products/${protectedProduct.id}/versions`)
        .set('Cookie', owner.cookie)
        .send({
          expectedCompositionRevision: protectedComposition.revision,
          ...protectedField,
        })
        .expect(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    }
  });

  it('keeps history frozen, validates revision/isolation, rolls back audit failure and numbers concurrent versions', async () => {
    const product = await createProduct(owner, 'version-history');
    const source = await createProduct(owner, 'version-history-source', {
      unit: 'KG',
      directCost: '9.75',
    });
    const historyProfile = await createProfile([
      { name: 'Original', category: 'TAX', rate: '0.01', origin: 'MANUAL' },
    ]);
    const persisted = await persistComposition(
      product.id,
      composition(historyProfile.id, source.id),
    );
    const url = `/api/pricing/products/${product.id}/versions`;

    const conflict = await request(server())
      .post(url)
      .set('Cookie', owner.cookie)
      .send({ expectedCompositionRevision: persisted.revision + 1 })
      .expect(409);
    expect(conflict.body.code).toBe('PRICING_REVISION_CONFLICT');

    const first = await request(server())
      .post(url)
      .set('Cookie', owner.cookie)
      .send({
        expectedCompositionRevision: persisted.revision,
        adoptedPrice: '20.00',
      })
      .expect(201);
    expect(first.body.snapshot.input.adoptedPrice).toBe('20');
    expect(first.body.snapshot.result.adoptedPrice).toBe('20.00');
    expect(first.body.snapshot.result.analysis.price).toBe('20.00');
    const frozen = JSON.stringify(first.body.snapshot);

    await prisma.product.update({
      where: { id: source.id },
      data: { directCost: '19.50' },
    });
    await request(server())
      .patch(`/api/pricing/profiles/${historyProfile.id}`)
      .set('Cookie', owner.cookie)
      .send({
        expectedRevision: historyProfile.currentRevision.revision,
        name: `Changed ${randomUUID()}`,
        deductions: [
          {
            name: 'Changed',
            category: 'TAX',
            rate: '0.02',
            origin: 'MANUAL',
          },
        ],
      })
      .expect(200);
    const currentConfiguration = await request(server())
      .get('/api/pricing/configuration')
      .set('Cookie', owner.cookie)
      .expect(200);
    await request(server())
      .patch('/api/pricing/configuration')
      .set('Cookie', owner.cookie)
      .send({
        expectedRevision: currentConfiguration.body.currentRevision.revision,
        fixedCostRate: '0.02',
        parameterOrigins: { fixedCostRate: { origin: 'MANUAL' } },
      })
      .expect(200);
    const changedComposition = await persistComposition(product.id, {
      ...composition(historyProfile.id, source.id),
      expectedRevision: persisted.revision,
      desiredMargin: '0.30',
    });
    const detail = await request(server())
      .get(`${url}/${first.body.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);
    expect(JSON.stringify(detail.body.snapshot)).toBe(frozen);

    const [second, third] = await Promise.all([
      request(server())
        .post(url)
        .set('Cookie', owner.cookie)
        .send({ expectedCompositionRevision: changedComposition.revision }),
      request(server())
        .post(url)
        .set('Cookie', admin.cookie)
        .send({ expectedCompositionRevision: changedComposition.revision }),
    ]);
    expect([second.status, third.status]).toEqual([201, 201]);
    expect(
      [second.body.number, third.body.number].sort((a, b) => a - b),
    ).toEqual([2, 3]);
    expect(second.body.snapshot.input.components[0].unitCost).toBe('19.5');
    expect(third.body.snapshot.input.components[0].unitCost).toBe('19.5');

    const list = await request(server())
      .get(`${url}?page=1&pageSize=2`)
      .set('Cookie', finance.cookie)
      .expect(200);
    expect(list.body.pagination).toMatchObject({
      page: 1,
      pageSize: 2,
      total: 3,
    });
    expect(
      list.body.data.map((item: { number: number }) => item.number),
    ).toEqual([3, 2]);
    expect(list.body.data[0]).not.toHaveProperty('snapshot');

    await createConfiguration(foreign);
    const foreignProduct = await createProduct(foreign, 'version-foreign');
    const foreignComposition = await persistComposition(
      foreignProduct.id,
      composition(null),
      foreign,
    );
    const foreignVersion = await request(server())
      .post(`/api/pricing/products/${foreignProduct.id}/versions`)
      .set('Cookie', foreign.cookie)
      .send({ expectedCompositionRevision: foreignComposition.revision })
      .expect(201);
    const hiddenForeignProduct = await request(server())
      .get(
        `/api/pricing/products/${foreignProduct.id}/versions/${foreignVersion.body.id}`,
      )
      .set('Cookie', owner.cookie)
      .expect(404);
    expect(hiddenForeignProduct.body.code).toBe('PRODUCT_NOT_FOUND');
    for (const versionId of [foreignVersion.body.id, randomUUID()]) {
      const hiddenForeignVersion = await request(server())
        .get(`/api/pricing/products/${product.id}/versions/${versionId}`)
        .set('Cookie', owner.cookie)
        .expect(404);
      expect(hiddenForeignVersion.body.code).toBe('PRICING_VERSION_NOT_FOUND');
    }

    const beforeRollback = await sideEffectCounts(
      owner.organizationId,
      product.id,
    );
    const versions = app.get(PricingVersionsService) as unknown as {
      audit: (...args: unknown[]) => Promise<unknown>;
    };
    const auditSpy = vi
      .spyOn(versions, 'audit')
      .mockRejectedValueOnce(new Error('forced audit failure'));
    try {
      await request(server())
        .post(url)
        .set('Cookie', owner.cookie)
        .send({ expectedCompositionRevision: changedComposition.revision })
        .expect(500);
    } finally {
      auditSpy.mockRestore();
    }
    expect(await sideEffectCounts(owner.organizationId, product.id)).toEqual(
      beforeRollback,
    );
  });

  async function sideEffectCounts(organizationId: string, productId: string) {
    const [
      versions,
      audits,
      stockMovements,
      financialEntries,
      compositions,
      product,
    ] = await Promise.all([
      prisma.pricingCalculationVersion.count({
        where: { organizationId, productId },
      }),
      prisma.auditLog.count({ where: { organizationId } }),
      prisma.stockMovement.count({ where: { organizationId } }),
      prisma.financialEntry.count({ where: { organizationId } }),
      prisma.productPricingComposition.count({
        where: { organizationId, productId },
      }),
      prisma.product.findUniqueOrThrow({
        where: { id: productId },
        select: { salePrice: true, adoptedPricingVersionId: true },
      }),
    ]);
    return {
      versions,
      audits,
      stockMovements,
      financialEntries,
      compositions,
      salePrice: product.salePrice?.toFixed() ?? null,
      adoptedPricingVersionId: product.adoptedPricingVersionId,
    };
  }
});
