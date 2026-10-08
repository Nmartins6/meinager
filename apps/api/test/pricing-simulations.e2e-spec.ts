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
import { PricingCalculationsService } from '../src/pricing/services/pricing-calculations.service.js';

interface Identity {
  cookie: string;
  organizationId: string;
  userId: string;
}

describe('Authoritative pricing simulations (e2e)', () => {
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
        'Pricing simulations E2E requires its disposable PostgreSQL runner.',
      );
    }
    const resolved = new URL(url).pathname.slice(1);
    if (
      resolved !== expected ||
      resolved === normal ||
      !/^pricing_configuration_e2e_[a-f0-9]{16}$/.test(resolved)
    ) {
      throw new Error(
        `Refusing non-disposable pricing simulations database: ${resolved}`,
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
        `Simulation identity registration failed: ${response.status} ${JSON.stringify(response.body)}`,
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

  function draft(overrides: Record<string, unknown> = {}) {
    const base = composition(null);
    const { expectedRevision: _expectedRevision, ...editable } = base;
    return { ...editable, ...overrides };
  }

  async function persistComposition(
    productId: string,
    payload: ReturnType<typeof composition>,
  ) {
    return request(server())
      .put(`/api/pricing/products/${productId}/composition`)
      .set('Cookie', owner.cookie)
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

  it('enforces authentication and the complete five-role matrix', async () => {
    const product = await createProduct(owner, 'roles');
    await persistComposition(product.id, composition(null));
    const url = `/api/pricing/products/${product.id}/simulations`;
    const body = { source: 'PERSISTED' };

    const unauthenticated = await request(server())
      .post(url)
      .send(body)
      .expect(401);
    expect(unauthenticated.body.code).toBe('AUTHENTICATION_REQUIRED');
    for (const identity of [owner, admin, operations]) {
      await request(server())
        .post(url)
        .set('Cookie', identity.cookie)
        .send(body)
        .expect(200);
    }
    for (const identity of [finance, viewer]) {
      const response = await request(server())
        .post(url)
        .set('Cookie', identity.cookie)
        .send(body)
        .expect(403);
      expect(response.body.code).toBe('PRICING_FORBIDDEN');
    }
  });

  it('hides foreign and nonexistent products with the same error', async () => {
    const foreignProduct = await createProduct(foreign, 'foreign');
    for (const productId of [foreignProduct.id, randomUUID()]) {
      const response = await request(server())
        .post(`/api/pricing/products/${productId}/simulations`)
        .set('Cookie', owner.cookie)
        .send({ source: 'DRAFT', draft: draft() })
        .expect(404);
      expect(response.body.code).toBe('PRODUCT_NOT_FOUND');
    }
  });

  it('requires configuration and the selected persisted composition', async () => {
    const unconfigured = await createProduct(noConfiguration, 'unconfigured');
    const missingConfiguration = await request(server())
      .post(`/api/pricing/products/${unconfigured.id}/simulations`)
      .set('Cookie', noConfiguration.cookie)
      .send({ source: 'DRAFT', draft: draft() })
      .expect(409);
    expect(missingConfiguration.body.code).toBe(
      'PRICING_CONFIGURATION_REQUIRED',
    );

    const product = await createProduct(owner, 'without-composition');
    const missingComposition = await request(server())
      .post(`/api/pricing/products/${product.id}/simulations`)
      .set('Cookie', owner.cookie)
      .send({ source: 'PERSISTED' })
      .expect(404);
    expect(missingComposition.body.code).toBe('PRICING_COMPOSITION_NOT_FOUND');
  });

  it('reproduces EX-001 through persisted authoritative inputs', async () => {
    const product = await createProduct(owner, 'EX-001', { salePrice: '77' });
    const profile = await createProfile();
    const persisted = await persistComposition(
      product.id,
      composition(profile.id),
    );
    const response = await request(server())
      .post(`/api/pricing/products/${product.id}/simulations`)
      .set('Cookie', owner.cookie)
      .send({ source: 'PERSISTED' })
      .expect(200);
    expect(response.body).toMatchObject({
      productId: product.id,
      source: 'PERSISTED',
      compositionRevision: persisted.revision,
      formulaVersion: 'margin-divisor-v1',
      result: {
        baseCost: { exact: '50', display: '50.00' },
        minimumPrice: { exact: '62.5', commercial: '62.50' },
        suggestedPrice: { commercial: '90.91' },
        analysis: {
          price: '90.91',
          profit: { exact: '22.728', display: '22.73' },
          effectiveMargin:
            '0.2500054999450005499945000549994500054999450005499945000549994500054999450005499945000549994500054999450005499945000549994500054999450005499945000549994500054999',
          classification: 'DESIRED_MARGIN_MET',
        },
      },
    });
    expect(
      response.body.resolvedInput.deductions.map(
        (item: { name: string }) => item.name,
      ),
    ).toEqual(['Imposto', 'Pagamento']);
  });

  it('reproduces EX-002 through a complete authoritative draft', async () => {
    const identity = await register('EX-002');
    await request(server())
      .patch('/api/pricing/configuration')
      .set('Cookie', identity.cookie)
      .send({
        expectedRevision: null,
        currency: 'BRL',
        fixedCostMode: 'MONTHLY',
        monthlyFixedCost: '3000',
        averageMonthlyRevenue: '15000',
        monthlyLaborCost: '3300',
        productiveHours: '165',
        defaultDesiredMargin: '0.25',
        parameterOrigins: {
          fixedCostMode: { origin: 'MANUAL' },
          monthlyFixedCost: { origin: 'MANUAL' },
          averageMonthlyRevenue: { origin: 'MANUAL' },
          monthlyLaborCost: { origin: 'MANUAL' },
          productiveHours: { origin: 'MANUAL' },
          defaultDesiredMargin: { origin: 'MANUAL' },
        },
      })
      .expect(200);
    const profile = await createProfile(
      [
        { name: 'Imposto', category: 'TAX', rate: '0.06', origin: 'MANUAL' },
        {
          name: 'Pagamento',
          category: 'PAYMENT',
          rate: '0.035',
          origin: 'MANUAL',
        },
        {
          name: 'Comissão',
          category: 'COMMISSION',
          rate: '0.02',
          origin: 'MANUAL',
        },
      ],
      identity,
    );
    const product = await createProduct(identity, 'EX-002');
    const response = await request(server())
      .post(`/api/pricing/products/${product.id}/simulations`)
      .set('Cookie', identity.cookie)
      .send({
        source: 'DRAFT',
        draft: draft({
          profileId: profile.id,
          laborEnabled: true,
          timeMinutes: '90',
          freightMode: 'ALLOCATED',
          freightTotalCost: '120',
          freightQuantity: '40',
          freightConsumedQuantity: null,
          components: [
            {
              description: 'Materiais',
              category: 'MATERIAL',
              unit: 'UN',
              quantity: '2',
              costSource: 'MANUAL',
              storedUnitCost: '12.5',
            },
            {
              description: 'Embalagem',
              category: 'PACKAGING',
              unit: 'UN',
              quantity: '1',
              costSource: 'MANUAL',
              storedUnitCost: '2',
            },
            {
              description: 'Perdas',
              category: 'LOSS',
              unit: 'UN',
              quantity: '1',
              costSource: 'MANUAL',
              storedUnitCost: '1.5',
            },
          ],
        }),
      })
      .expect(200);
    expect(response.body.result).toMatchObject({
      baseCost: { exact: '61.5', display: '61.50' },
      fixedCosts: { rate: '0.2' },
      totalDeductionRate: '0.115',
      minimumPrice: { commercial: '89.79' },
      suggestedPrice: { commercial: '141.38' },
      analysis: {
        price: '141.38',
        profit: { exact: '35.3453', display: '35.35' },
        classification: 'DESIRED_MARGIN_MET',
      },
    });
  });

  it('simulates a complete draft with no persistence and analyzes adoptedPrice', async () => {
    const product = await createProduct(owner, 'draft-complete', {
      salePrice: '88.50',
    });
    const source = await createProduct(owner, 'draft-source', {
      unit: 'KG',
      directCost: '12.5',
    });
    const profile = await createProfile([
      { name: 'Tax', category: 'TAX', rate: '0.05', origin: 'MANUAL' },
    ]);
    const completeDraft = draft({
      profileId: profile.id,
      laborEnabled: true,
      timeMinutes: '90',
      freightMode: 'ALLOCATED',
      freightTotalCost: '30',
      freightQuantity: '10',
      freightConsumedQuantity: null,
      parameterOrigins: {
        desiredMargin: { origin: 'MANUAL' },
        laborEnabled: { origin: 'MANUAL' },
        timeMinutes: { origin: 'MANUAL' },
        freightMode: { origin: 'MANUAL' },
        freightTotalCost: { origin: 'MANUAL' },
        freightQuantity: { origin: 'MANUAL' },
      },
      components: [
        {
          description: 'Manual',
          category: 'MATERIAL',
          unit: 'UN',
          quantity: '2',
          costSource: 'MANUAL',
          storedUnitCost: '5',
        },
        {
          description: 'Copied',
          category: 'PACKAGING',
          unit: 'UN',
          quantity: '1',
          costSource: 'COPIED',
          storedUnitCost: '2',
        },
        {
          description: 'Catalog',
          category: 'MATERIAL',
          unit: 'KG',
          quantity: '3',
          costSource: 'CATALOG',
          sourceProductId: source.id,
        },
      ],
    });
    const before = await sideEffectCounts(owner.organizationId, product.id);
    const response = await request(server())
      .post(`/api/pricing/products/${product.id}/simulations`)
      .set('Cookie', owner.cookie)
      .send({ source: 'DRAFT', draft: completeDraft, adoptedPrice: '60.00' })
      .expect(200);
    expect(response.body).toMatchObject({
      source: 'DRAFT',
      compositionRevision: null,
      profile: { id: profile.id },
      adoptedPrice: '60.00',
      result: {
        adoptedPrice: '60.00',
        freight: { mode: 'ALLOCATED', consumedQuantity: '1' },
        analysis: { price: '60.00' },
      },
    });
    expect(response.body.resolvedInput.components[2]).toMatchObject({
      origin: 'CATALOG',
      unitCost: '12.5',
      productId: source.id,
    });
    expect(response.body.resolvedInput.freight).not.toHaveProperty(
      'consumedQuantity',
    );
    expect(await sideEffectCounts(owner.organizationId, product.id)).toEqual(
      before,
    );
  });

  it('uses the current catalog directCost and returns tiny rates without exponent', async () => {
    const product = await createProduct(owner, 'catalog-roundtrip');
    const source = await createProduct(owner, 'catalog-current', {
      unit: 'KG',
      directCost: '8',
    });
    await persistComposition(product.id, composition(null, source.id));
    await prisma.product.update({
      where: { id: source.id },
      data: { directCost: '9.75' },
    });
    const current = await request(server())
      .post(`/api/pricing/products/${product.id}/simulations`)
      .set('Cookie', owner.cookie)
      .send({ source: 'PERSISTED' })
      .expect(200);
    expect(current.body.resolvedInput.components[0].unitCost).toBe('9.75');

    const config = await request(server())
      .get('/api/pricing/configuration')
      .set('Cookie', owner.cookie)
      .expect(200);
    await request(server())
      .patch('/api/pricing/configuration')
      .set('Cookie', owner.cookie)
      .send({
        expectedRevision: config.body.currentRevision.revision,
        fixedCostRate: '0.00000001',
        parameterOrigins: { fixedCostRate: { origin: 'MANUAL' } },
      })
      .expect(200);
    const tiny = await request(server())
      .post(`/api/pricing/products/${product.id}/simulations`)
      .set('Cookie', owner.cookie)
      .send({ source: 'PERSISTED' })
      .expect(200);
    expect(tiny.body.resolvedInput.fixedCosts.rate).toBe('0.00000001');
    expect(tiny.body.resolvedInput.fixedCosts.rate).not.toMatch(/[eE]/);
    await request(server())
      .post(`/api/pricing/products/${product.id}/simulations`)
      .set('Cookie', owner.cookie)
      .send({
        source: 'DRAFT',
        draft: {
          ...draft(),
          desiredMargin: tiny.body.effectiveDesiredMargin.value,
        },
      })
      .expect(200);
  });

  it('rejects inactive, foreign and absent profiles without leakage', async () => {
    const product = await createProduct(owner, 'profile-errors');
    const inactive = await createProfile([]);
    await request(server())
      .post(`/api/pricing/profiles/${inactive.id}/deactivate`)
      .set('Cookie', owner.cookie)
      .send({ expectedRevision: inactive.currentRevision.revision })
      .expect(200);
    const inactiveResponse = await request(server())
      .post(`/api/pricing/products/${product.id}/simulations`)
      .set('Cookie', owner.cookie)
      .send({ source: 'DRAFT', draft: draft({ profileId: inactive.id }) })
      .expect(409);
    expect(inactiveResponse.body.code).toBe('PRICING_PROFILE_INACTIVE');

    const foreignProfile = await request(server())
      .post('/api/pricing/profiles')
      .set('Cookie', foreign.cookie)
      .send({ name: `Foreign ${randomUUID()}`, deductions: [] })
      .expect(201);
    const foreignProfileId = foreignProfile.body.id;
    for (const profileId of [foreignProfileId, randomUUID()]) {
      const response = await request(server())
        .post(`/api/pricing/products/${product.id}/simulations`)
        .set('Cookie', owner.cookie)
        .send({ source: 'DRAFT', draft: draft({ profileId }) })
        .expect(404);
      expect(response.body.code).toBe('PRICING_PROFILE_NOT_FOUND');
    }
  });

  it('maps divisor, labor and freight failures to stable 400 responses', async () => {
    const product = await createProduct(owner, 'typed-errors');
    const negativeDivisorProfile = await createProfile([
      { name: 'Total', category: 'TAX', rate: '0.75', origin: 'MANUAL' },
    ]);
    const zeroDivisorProfile = await createProfile([
      {
        name: 'Exact total',
        category: 'TAX',
        rate: '0.74999999',
        origin: 'MANUAL',
      },
    ]);
    const cases = [
      {
        draft: draft({ profileId: negativeDivisorProfile.id }),
        code: 'INVALID_PRICING_DIVISOR',
      },
      {
        draft: draft({ profileId: zeroDivisorProfile.id }),
        code: 'INVALID_PRICING_DIVISOR',
      },
      {
        draft: draft({
          freightMode: 'ALLOCATED',
          freightTotalCost: '10',
          freightQuantity: '0',
          freightConsumedQuantity: null,
        }),
        code: 'INVALID_FREIGHT_QUANTITY',
      },
    ];
    for (const testCase of cases) {
      const response = await request(server())
        .post(`/api/pricing/products/${product.id}/simulations`)
        .set('Cookie', owner.cookie)
        .send({ source: 'DRAFT', draft: testCase.draft })
        .expect(400);
      expect(response.body.code).toBe(testCase.code);
    }

    const noLabor = await register('no-labor');
    const noLaborConfiguration = configuration(null);
    const {
      monthlyLaborCost: _monthlyLaborCost,
      productiveHours: _productiveHours,
      ...configurationWithoutLabor
    } = noLaborConfiguration;
    const {
      monthlyLaborCost: _monthlyLaborOrigin,
      productiveHours: _productiveHoursOrigin,
      ...originsWithoutLabor
    } = noLaborConfiguration.parameterOrigins;
    await request(server())
      .patch('/api/pricing/configuration')
      .set('Cookie', noLabor.cookie)
      .send({
        ...configurationWithoutLabor,
        parameterOrigins: originsWithoutLabor,
      })
      .expect(200);
    const noLaborProduct = await createProduct(noLabor, 'no-labor');
    const laborResponse = await request(server())
      .post(`/api/pricing/products/${noLaborProduct.id}/simulations`)
      .set('Cookie', noLabor.cookie)
      .send({
        source: 'DRAFT',
        draft: draft({ laborEnabled: true, timeMinutes: '10' }),
      })
      .expect(400);
    expect(laborResponse.body.code).toBe('INVALID_PRODUCTIVE_HOURS');
  });

  it('rejects invalid catalog states and protected client results', async () => {
    const product = await createProduct(owner, 'catalog-errors');
    const withoutCost = await createProduct(owner, 'catalog-no-cost', {
      unit: 'KG',
      directCost: null,
    });
    const inactive = await createProduct(owner, 'catalog-inactive', {
      unit: 'KG',
      isActive: false,
    });
    const foreignSource = await createProduct(foreign, 'catalog-foreign', {
      unit: 'KG',
    });
    for (const sourceProductId of [withoutCost.id, inactive.id]) {
      const response = await request(server())
        .post(`/api/pricing/products/${product.id}/simulations`)
        .set('Cookie', owner.cookie)
        .send({
          source: 'DRAFT',
          draft: catalogDraft(sourceProductId),
        })
        .expect(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    }
    for (const sourceProductId of [foreignSource.id, randomUUID()]) {
      const response = await request(server())
        .post(`/api/pricing/products/${product.id}/simulations`)
        .set('Cookie', owner.cookie)
        .send({ source: 'DRAFT', draft: catalogDraft(sourceProductId) })
        .expect(404);
      expect(response.body.code).toBe('PRODUCT_NOT_FOUND');
    }
    const self = await request(server())
      .post(`/api/pricing/products/${product.id}/simulations`)
      .set('Cookie', owner.cookie)
      .send({ source: 'DRAFT', draft: catalogDraft(product.id) })
      .expect(400);
    expect(self.body.code).toBe('VALIDATION_ERROR');

    for (const protectedField of [
      { organizationId: foreign.organizationId },
      { actorUserId: foreign.userId },
      { result: {} },
      { total: '10' },
      { formulaVersion: 'margin-divisor-v1' },
      { classification: 'DESIRED_MARGIN_MET' },
      { snapshot: {} },
    ]) {
      const response = await request(server())
        .post(`/api/pricing/products/${product.id}/simulations`)
        .set('Cookie', owner.cookie)
        .send({ source: 'DRAFT', draft: draft(), ...protectedField })
        .expect(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    }
  });

  it('keeps catalog and configuration reads in one REPEATABLE READ view during a concurrent update', async () => {
    const product = await createProduct(owner, 'consistent-target');
    const source = await createProduct(owner, 'consistent-source', {
      unit: 'KG',
      directCost: '10',
    });
    await persistComposition(product.id, composition(null, source.id));
    const calculations = app.get(PricingCalculationsService) as unknown as {
      readCatalogProducts: (...args: unknown[]) => Promise<unknown>;
    };
    const original = calculations.readCatalogProducts.bind(calculations);
    let release: (() => void) | undefined;
    let reached: (() => void) | undefined;
    const reachedPromise = new Promise<void>((resolve) => {
      reached = resolve;
    });
    const releasePromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    const spy = vi
      .spyOn(calculations, 'readCatalogProducts')
      .mockImplementation(async (...args: unknown[]) => {
        reached?.();
        await releasePromise;
        return original(...args);
      });
    try {
      const pending = request(server())
        .post(`/api/pricing/products/${product.id}/simulations`)
        .set('Cookie', owner.cookie)
        .send({ source: 'PERSISTED' });
      const responsePromise = pending.then((response) => response);
      await reachedPromise;
      await prisma.product.update({
        where: { id: source.id },
        data: { directCost: '20' },
      });
      release?.();
      const response = await responsePromise;
      expect(response.status).toBe(200);
      expect(response.body.resolvedInput.components[0].unitCost).toBe('10');
    } finally {
      release?.();
      spy.mockRestore();
    }
    const next = await request(server())
      .post(`/api/pricing/products/${product.id}/simulations`)
      .set('Cookie', owner.cookie)
      .send({ source: 'PERSISTED' })
      .expect(200);
    expect(next.body.resolvedInput.components[0].unitCost).toBe('20');
  });

  function catalogDraft(sourceProductId: string) {
    return draft({
      components: [
        {
          description: 'Catalog',
          category: 'MATERIAL',
          unit: 'KG',
          quantity: '1',
          costSource: 'CATALOG',
          sourceProductId,
        },
      ],
    });
  }

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
