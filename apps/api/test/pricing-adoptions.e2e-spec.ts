import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { vi } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SessionService } from '../src/auth/session/session.service.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { Prisma } from '../src/generated/prisma/client.js';
import {
  OrganizationRole,
  ProductType,
} from '../src/generated/prisma/enums.js';
import { PricingAdoptionsService } from '../src/pricing/services/pricing-adoptions.service.js';

interface Identity {
  cookie: string;
  organizationId: string;
  userId: string;
}

describe('Pricing price adoptions (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let owner: Identity;
  let admin: Identity;
  let operations: Identity;
  let finance: Identity;
  let viewer: Identity;
  let foreign: Identity;

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
      throw new Error('Pricing adoptions E2E requires the disposable runner.');
    }
    const resolved = new URL(url).pathname.slice(1);
    if (
      resolved !== expected ||
      resolved === normal ||
      !/^pricing_configuration_e2e_[a-f0-9]{16}$/.test(resolved)
    ) {
      throw new Error(
        `Refusing non-disposable pricing adoptions database: ${resolved}`,
      );
    }
  }

  async function register(label: string): Promise<Identity> {
    const suffix = randomUUID();
    const response = await request(server())
      .post('/api/auth/register')
      .send({
        name: `Adoptions ${label}`,
        email: `adoptions.${suffix}@example.com`,
        password: 'senha-e2e-segura',
        organizationName: `Adoptions ${label} ${suffix}`,
      });
    if (response.status !== 201) {
      throw new Error(
        `Pricing adoption identity registration failed: ${response.status} ${JSON.stringify(response.body)}`,
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
        name: `Adoption ${role}`,
        email: `adoption.${role.toLowerCase()}.${suffix}@example.com`,
        normalizedEmail: `adoption.${role.toLowerCase()}.${suffix}@example.com`,
        passwordHash: 'test-only',
        memberships: { create: { organizationId: owner.organizationId, role } },
      },
    });
    const session = await app.get(SessionService).create(user.id);
    return {
      cookie: `meinager_session=${session.token}`,
      organizationId: owner.organizationId,
      userId: user.id,
    };
  }

  async function createConfiguration(identity: Identity) {
    return request(server())
      .patch('/api/pricing/configuration')
      .set('Cookie', identity.cookie)
      .send({
        expectedRevision: null,
        currency: 'BRL',
        fixedCostMode: 'RATE',
        fixedCostRate: '0.10',
        defaultDesiredMargin: '0.25',
        parameterOrigins: {
          fixedCostMode: { origin: 'MANUAL' },
          fixedCostRate: { origin: 'MANUAL' },
          defaultDesiredMargin: { origin: 'MANUAL' },
        },
      })
      .expect(200);
  }

  async function createPricedProduct(identity = owner, label = 'product') {
    const name = `Adoption ${label} ${randomUUID()}`;
    const product = await prisma.product.create({
      data: {
        organizationId: identity.organizationId,
        type: ProductType.PRODUCT,
        name,
        normalizedName: name.toLowerCase(),
        unit: 'UN',
        directCost: '50',
        salePrice: '40.00',
      },
    });
    const composition = await request(server())
      .put(`/api/pricing/products/${product.id}/composition`)
      .set('Cookie', identity.cookie)
      .send({
        expectedRevision: null,
        profileId: null,
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
        components: [
          {
            description: 'Base cost',
            category: 'DIRECT_COST',
            unit: 'UN',
            quantity: '1',
            costSource: 'MANUAL',
            storedUnitCost: '50',
          },
        ],
      })
      .expect(200);
    return { product, revision: composition.body.revision as number };
  }

  async function createVersion(
    productId: string,
    revision: number,
    adoptedPrice?: string,
    identity = owner,
  ) {
    return request(server())
      .post(`/api/pricing/products/${productId}/versions`)
      .set('Cookie', identity.cookie)
      .send({
        expectedCompositionRevision: revision,
        ...(adoptedPrice === undefined ? {} : { adoptedPrice }),
      })
      .expect(201)
      .then((response) => response.body);
  }

  function adopt(
    identity: Identity,
    productId: string,
    versionId: string,
    extra: Record<string, unknown> = {},
  ) {
    return request(server())
      .post(`/api/pricing/products/${productId}/adoptions`)
      .set('Cookie', identity.cookie)
      .send({ versionId, ...extra });
  }

  async function counts(productId: string) {
    const [product, events, audits, versions, compositions, stock, financial] =
      await Promise.all([
        prisma.product.findUniqueOrThrow({
          where: { id: productId },
          select: { salePrice: true, adoptedPricingVersionId: true },
        }),
        prisma.pricingPriceAdoption.count({
          where: { organizationId: owner.organizationId, productId },
        }),
        prisma.auditLog.count({
          where: {
            organizationId: owner.organizationId,
            entityId: productId,
            action: { startsWith: 'product_price.adopted' },
          },
        }),
        prisma.pricingCalculationVersion.count({
          where: { organizationId: owner.organizationId, productId },
        }),
        prisma.productPricingComposition.count({
          where: { organizationId: owner.organizationId, productId },
        }),
        prisma.stockMovement.count({
          where: { organizationId: owner.organizationId },
        }),
        prisma.financialEntry.count({
          where: { organizationId: owner.organizationId },
        }),
      ]);
    return {
      salePrice: product.salePrice?.toFixed() ?? null,
      adoptedPricingVersionId: product.adoptedPricingVersionId,
      events,
      audits,
      versions,
      compositions,
      stock,
      financial,
    };
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
    await createConfiguration(owner);
    await createConfiguration(foreign);
  });

  afterAll(async () => {
    await app.close();
  });

  it('enforces authentication, all roles, strict input and organization isolation', async () => {
    const { product, revision } = await createPricedProduct();
    const versions = await Promise.all([
      createVersion(product.id, revision),
      createVersion(product.id, revision, '70.00'),
      createVersion(product.id, revision, '55.56'),
    ]);
    await request(server())
      .post(`/api/pricing/products/${product.id}/adoptions`)
      .send({ versionId: versions[0].id })
      .expect(401);
    for (const identity of [finance, viewer]) {
      const response = await adopt(identity, product.id, versions[0].id).expect(
        403,
      );
      expect(response.body.code).toBe('PRICING_FORBIDDEN');
    }
    for (const [identity, version] of [
      [owner, versions[0]],
      [admin, versions[1]],
      [operations, versions[2]],
    ] as const) {
      const response = await adopt(identity, product.id, version.id).expect(
        200,
      );
      expect(response.body).toMatchObject({
        product: {
          id: product.id,
          salePrice: version.analyzedPrice.replace(/\.00$/, ''),
          adoptedPricingVersionId: version.id,
        },
        adoption: {
          productId: product.id,
          versionId: version.id,
          newPrice: version.analyzedPrice.replace(/\.00$/, ''),
        },
      });
      expect(response.body.product.salePrice).not.toMatch(/[eE][+-]?\d/);
      expect(response.body.adoption.newPrice).not.toMatch(/[eE][+-]?\d/);
    }

    for (const protectedField of [
      { organizationId: foreign.organizationId },
      { actorUserId: foreign.userId },
      { newPrice: '1.00' },
      { previousPrice: '1.00' },
      { classification: 'COST_COVERAGE' },
      { snapshot: {} },
      { formulaVersion: 'margin-divisor-v1' },
      { adoptedPricingVersionId: versions[0].id },
      { createdAt: new Date().toISOString() },
      { id: randomUUID() },
      { result: {} },
    ]) {
      const response = await adopt(
        owner,
        product.id,
        versions[0].id,
        protectedField,
      ).expect(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    }

    const foreignFixture = await createPricedProduct(foreign, 'foreign');
    const foreignVersion = await createVersion(
      foreignFixture.product.id,
      foreignFixture.revision,
      undefined,
      foreign,
    );
    expect(
      (await adopt(owner, product.id, foreignVersion.id).expect(404)).body.code,
    ).toBe('PRICING_VERSION_NOT_FOUND');
    expect(
      (
        await adopt(owner, foreignFixture.product.id, foreignVersion.id).expect(
          404,
        )
      ).body.code,
    ).toBe('PRODUCT_NOT_FOUND');
  });

  it('requires and isolates below-minimum approval evidence', async () => {
    const { product, revision } = await createPricedProduct();
    const below = await createVersion(product.id, revision, '55.55');
    expect(below.classification).toBe('BELOW_MINIMUM');

    const forbidden = await adopt(operations, product.id, below.id, {
      belowMinimumConfirmed: true,
      justification: 'Operations cannot approve',
    }).expect(403);
    expect(forbidden.body.code).toBe('BELOW_MINIMUM_FORBIDDEN');

    for (const extra of [
      {},
      { belowMinimumConfirmed: false, justification: 'No confirmation' },
      { belowMinimumConfirmed: true },
      { belowMinimumConfirmed: true, justification: '' },
      { belowMinimumConfirmed: true, justification: '   ' },
    ]) {
      await adopt(owner, product.id, below.id, extra).expect(400);
    }
    for (const extra of [
      { belowMinimumConfirmed: null, justification: 'x' },
      { belowMinimumConfirmed: 'true', justification: 'x' },
      { belowMinimumConfirmed: true, justification: null },
    ]) {
      const invalid = await adopt(owner, product.id, below.id, extra).expect(
        400,
      );
      expect(invalid.body.code).toBe('VALIDATION_ERROR');
    }

    const response = await adopt(owner, product.id, below.id, {
      belowMinimumConfirmed: true,
      justification: '  Exceção aprovada  ',
    }).expect(200);
    const event = await prisma.pricingPriceAdoption.findUniqueOrThrow({
      where: { id: response.body.adoption.id },
    });
    expect(event.justification).toBe('Exceção aprovada');
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId: owner.organizationId,
        action: 'product_price.adopted_below_minimum',
        entityId: product.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit.metadata).toEqual({
      adoptionId: event.id,
      productId: product.id,
      versionId: below.id,
      previousVersionId: null,
      classification: 'BELOW_MINIMUM',
      belowMinimumConfirmed: true,
      previousPrice: '40',
      newPrice: '55.55',
      actorUserId: owner.userId,
    });
    const auditText = JSON.stringify(audit.metadata);
    expect(auditText).not.toContain('Exceção aprovada');
    expect(auditText).not.toMatch(/snapshot|component|deduction|cost/i);

    const beforeRetry = await counts(product.id);
    const retry = await adopt(owner, product.id, below.id).expect(200);
    expect(retry.body.adoption.id).toBe(event.id);
    expect(await counts(product.id)).toEqual(beforeRetry);

    const operationsRetry = await adopt(
      operations,
      product.id,
      below.id,
    ).expect(403);
    expect(operationsRetry.body.code).toBe('BELOW_MINIMUM_FORBIDDEN');
    expect(await counts(product.id)).toEqual(beforeRetry);
  });

  it('returns the existing below-minimum adoption to an admin retry without new evidence', async () => {
    const { product, revision } = await createPricedProduct();
    const below = await createVersion(product.id, revision, '55.55');
    const first = await adopt(admin, product.id, below.id, {
      belowMinimumConfirmed: true,
      justification: 'Admin approval',
    }).expect(200);
    const beforeRetry = await counts(product.id);

    const retry = await adopt(admin, product.id, below.id).expect(200);

    expect(retry.body.adoption.id).toBe(first.body.adoption.id);
    expect(retry.body.product).toEqual(first.body.product);
    expect(await counts(product.id)).toEqual(beforeRetry);
  });

  it('is idempotent under sequential and concurrent retries while A-B-A is a new transition', async () => {
    const { product, revision } = await createPricedProduct();
    const [versionA, versionB] = await Promise.all([
      createVersion(product.id, revision),
      createVersion(product.id, revision, '70.00'),
    ]);
    const before = await counts(product.id);
    await adopt(owner, product.id, versionA.id).expect(200);
    const first = await counts(product.id);
    await adopt(owner, product.id, versionA.id).expect(200);
    expect(await counts(product.id)).toEqual(first);

    await adopt(owner, product.id, versionB.id).expect(200);
    const beforeConcurrent = await counts(product.id);
    const concurrent = await Promise.all([
      adopt(owner, product.id, versionA.id),
      adopt(admin, product.id, versionA.id),
    ]);
    expect(concurrent.map((response) => response.status)).toEqual([200, 200]);
    const after = await counts(product.id);
    expect(after.events).toBe(beforeConcurrent.events + 1);
    expect(after.audits).toBe(beforeConcurrent.audits + 1);
    expect(after.salePrice).toBe(versionA.analyzedPrice.replace(/\.00$/, ''));
    expect(after.adoptedPricingVersionId).toBe(versionA.id);
    expect(after.versions).toBe(before.versions);
    expect(after.compositions).toBe(before.compositions);
    expect(after.stock).toBe(before.stock);
    expect(after.financial).toBe(before.financial);
    expect(after.events).toBe(before.events + 3);
    const latest = await prisma.pricingPriceAdoption.findFirstOrThrow({
      where: { organizationId: owner.organizationId, productId: product.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(latest.previousVersionId).toBe(versionB.id);
    const frozen = await prisma.pricingCalculationVersion.findUniqueOrThrow({
      where: { id: versionA.id },
      select: { snapshot: true },
    });
    expect(frozen.snapshot).toEqual(versionA.snapshot);
  });

  it('rolls back product and event on audit failure and rejects unfinished or invalid history', async () => {
    const { product, revision } = await createPricedProduct();
    const version = await createVersion(product.id, revision);
    const before = await counts(product.id);
    const service = app.get(PricingAdoptionsService) as unknown as {
      audit: (...args: unknown[]) => Promise<unknown>;
      adoptInTransaction: (...args: unknown[]) => Promise<unknown>;
    };
    const auditSpy = vi
      .spyOn(service, 'audit')
      .mockRejectedValueOnce(new Error('forced audit failure'));
    try {
      const failed = await adopt(owner, product.id, version.id).expect(500);
      expect(failed.body).toEqual({
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Não foi possível concluir a operação de precificação.',
      });
    } finally {
      auditSpy.mockRestore();
    }
    expect(await counts(product.id)).toEqual(before);

    await expect(
      prisma.$transaction(async (transaction) => {
        const building = await transaction.pricingCalculationVersion.create({
          data: {
            organizationId: owner.organizationId,
            productId: product.id,
            number: 99,
            compositionId: version.compositionId,
            compositionRevision: version.compositionRevision,
            configurationRevisionId: version.configurationRevisionId,
            profileRevisionId: version.profileRevisionId,
            snapshot: version.snapshot,
            minimumPriceCommercial: version.minimumPriceCommercial,
            suggestedPriceCommercial: version.suggestedPriceCommercial,
            analyzedPrice: version.analyzedPrice,
            classification: version.classification,
            componentCount: version.componentCount,
            deductionCount: version.deductionCount,
            formulaVersion: version.formulaVersion,
            snapshotSchemaVersion: version.snapshotSchemaVersion,
            createdByUserId: owner.userId,
          },
        });
        await service.adoptInTransaction(
          transaction,
          owner.organizationId,
          owner.userId,
          OrganizationRole.OWNER,
          product.id,
          { versionId: building.id },
        );
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'PRICING_VERSION_NOT_FINALIZED' },
    });

    const invalidId = randomUUID();
    await prisma.$transaction(async (transaction) => {
      await transaction.pricingCalculationVersion.create({
        data: {
          id: invalidId,
          organizationId: owner.organizationId,
          productId: product.id,
          number: 100,
          compositionId: version.compositionId,
          compositionRevision: version.compositionRevision,
          configurationRevisionId: version.configurationRevisionId,
          profileRevisionId: version.profileRevisionId,
          snapshot: {
            ...version.snapshot,
            snapshotSchemaVersion: 2,
          },
          minimumPriceCommercial: version.minimumPriceCommercial,
          suggestedPriceCommercial: version.suggestedPriceCommercial,
          analyzedPrice: version.analyzedPrice,
          classification: version.classification,
          componentCount: version.componentCount,
          deductionCount: version.deductionCount,
          formulaVersion: version.formulaVersion,
          snapshotSchemaVersion: 2,
          currency: version.currency,
          createdByUserId: owner.userId,
        },
      });
      await transaction.pricingVersionComponent.createMany({
        data: version.components.map((item: Record<string, unknown>) => ({
          organizationId: owner.organizationId,
          versionId: invalidId,
          position: item.position as number,
          description: item.description as string,
          category: item.category as 'DIRECT_COST',
          unit: item.unit as string,
          quantity: item.quantity as string,
          effectiveUnitCost: item.effectiveUnitCost as string,
          totalExact: item.totalExact as string,
          totalDisplay: item.totalDisplay as string,
          sourceProductId: item.sourceProductId as string | null,
          costSource: item.costSource as 'MANUAL',
          originDetails: item.originDetails as Prisma.InputJsonValue,
        })),
      });
      await transaction.pricingCalculationVersion.update({
        where: { id: invalidId },
        data: { state: 'FINALIZED', finalizedAt: new Date() },
      });
    });
    const invalid = await adopt(owner, product.id, invalidId).expect(500);
    expect(invalid.body).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Não foi possível concluir a operação de precificação.',
    });
  });
});
