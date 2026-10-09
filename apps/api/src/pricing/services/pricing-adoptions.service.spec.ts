import { calculatePricing } from '../calculator/pricing-calculator.js';
import {
  materializePricingSnapshotInputV1,
  materializePricingSnapshotResultV1,
  type PricingSnapshotV1,
} from '../contracts/pricing-snapshot-v1.js';
import type { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  OrganizationRole,
  PricingClassification,
} from '../../generated/prisma/enums.js';
import { PricingErrorCode } from '../errors/pricing-http.exception.js';
import { PricingAdoptionsService } from './pricing-adoptions.service.js';

describe('PricingAdoptionsService', () => {
  const ids = {
    organization: '00000000-0000-4000-8000-000000000001',
    actor: '00000000-0000-4000-8000-000000000002',
    product: '00000000-0000-4000-8000-000000000003',
    version: '00000000-0000-4000-8000-000000000004',
    composition: '00000000-0000-4000-8000-000000000005',
    configurationRevision: '00000000-0000-4000-8000-000000000006',
    adoption: '00000000-0000-4000-8000-000000000007',
  };

  function snapshot(adoptedPrice = '10.00'): PricingSnapshotV1 {
    const calculatorInput = {
      currency: 'BRL' as const,
      components: [
        {
          description: 'Material',
          category: 'MATERIAL' as const,
          unit: 'UN',
          quantity: '1',
          unitCost: '5',
          origin: 'MANUAL' as const,
        },
      ],
      fixedCosts: {
        mode: 'RATE' as const,
        rate: '0.1',
        origin: 'MANUAL' as const,
      },
      desiredMargin: '0.25',
      adoptedPrice,
    };
    const input = materializePricingSnapshotInputV1(calculatorInput);
    const result = materializePricingSnapshotResultV1(
      calculatePricing(calculatorInput),
    );
    return {
      snapshotSchemaVersion: 1,
      formulaVersion: 'margin-divisor-v1',
      input,
      result,
      context: {
        organizationId: ids.organization,
        product: {
          id: ids.product,
          type: 'PRODUCT',
          name: 'Product',
          unit: 'UN',
        },
        composition: {
          id: ids.composition,
          revision: 1,
          parameterOrigins: [
            {
              schemaVersion: 1,
              parameter: 'desiredMargin',
              origin: 'MANUAL',
              ...provenanceDetails(),
            },
          ],
        },
        configuration: {
          id: '00000000-0000-4000-8000-000000000008',
          revisionId: ids.configurationRevision,
          revision: 1,
          effectiveFrom: '2026-10-08T12:00:00.000Z',
          currency: 'BRL',
          fixedCosts: { mode: 'RATE', rate: '0.1' },
          monthlyLaborCost: null,
          productiveHours: null,
          defaultDesiredMargin: null,
          parameterOrigins: [
            {
              schemaVersion: 1,
              parameter: 'fixedCostRate',
              origin: 'MANUAL',
              ...provenanceDetails(),
            },
          ],
        },
        salesProfile: null,
        effectiveDesiredMargin: {
          value: '0.25',
          origin: 'MANUAL',
          precedence: 'COMPOSITION',
        },
        componentOrigins: [
          {
            schemaVersion: 1,
            position: 1,
            origin: 'MANUAL',
            sourceProductId: null,
            effectiveUnitCost: '5',
            ...provenanceDetails(),
          },
        ],
        deductionOrigins: [],
        calculatedAt: '2026-10-08T12:00:00.000Z',
        calculatedByUserId: ids.actor,
        decimalPolicy: {
          library: 'decimal.js',
          precision: 160,
          commercialRounding: 'ROUND_CEIL',
          informationalRounding: 'ROUND_HALF_UP',
        },
      },
    };
  }

  function provenanceDetails() {
    return {
      source: null,
      referenceId: null,
      periodStart: null,
      periodEnd: null,
      criterion: null,
      measuredAt: null,
      confirmedByUserId: ids.actor,
    };
  }

  function version(value = snapshot()) {
    const component = value.result.components[0]!;
    return {
      id: ids.version,
      organizationId: ids.organization,
      productId: ids.product,
      compositionId: ids.composition,
      compositionRevision: 1,
      configurationRevisionId: ids.configurationRevision,
      profileRevisionId: null,
      state: 'FINALIZED' as const,
      snapshot: value,
      minimumPriceCommercial: value.result.minimumPrice.commercial,
      suggestedPriceCommercial: value.result.suggestedPrice.commercial,
      analyzedPrice: value.result.analysis.price,
      classification: value.result.analysis.classification,
      componentCount: 1,
      deductionCount: 0,
      formulaVersion: 'margin-divisor-v1',
      snapshotSchemaVersion: 1,
      currency: 'BRL',
      components: [
        {
          position: 1,
          description: component.description,
          category: component.category,
          unit: component.unit,
          quantity: new Prisma.Decimal(component.quantity),
          effectiveUnitCost: new Prisma.Decimal(component.unitCost),
          totalExact: component.total.exact,
          totalDisplay: component.total.display,
          sourceProductId: component.productId,
          costSource: component.origin,
          originDetails: value.context.componentOrigins[0],
        },
      ],
      deductions: [],
    };
  }

  function adoptionRecord(overrides: Record<string, unknown> = {}) {
    return {
      id: ids.adoption,
      productId: ids.product,
      versionId: ids.version,
      previousVersionId: null,
      previousPrice: new Prisma.Decimal('8.00'),
      newPrice: new Prisma.Decimal('10.00'),
      classification: PricingClassification.DESIRED_MARGIN_MET,
      belowMinimumConfirmed: false,
      justification: null,
      createdByUserId: ids.actor,
      createdAt: new Date('2026-10-08T13:00:00.000Z'),
      ...overrides,
    };
  }

  const transaction = {
    $queryRaw: vi.fn(),
    product: { findFirst: vi.fn(), update: vi.fn() },
    pricingCalculationVersion: { findFirst: vi.fn() },
    pricingPriceAdoption: { findFirst: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const prisma = { $transaction: vi.fn() };
  let service: PricingAdoptionsService;

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
    );
    transaction.$queryRaw.mockResolvedValue([{ id: ids.product }]);
    transaction.product.findFirst.mockResolvedValue({
      id: ids.product,
      salePrice: new Prisma.Decimal('8.00'),
      adoptedPricingVersionId: null,
    });
    transaction.pricingCalculationVersion.findFirst.mockResolvedValue(
      version(),
    );
    transaction.product.update.mockResolvedValue({ id: ids.product });
    transaction.pricingPriceAdoption.create.mockResolvedValue(adoptionRecord());
    transaction.auditLog.create.mockResolvedValue({ id: 'audit' });
    service = new PricingAdoptionsService(prisma as unknown as PrismaService);
  });

  const adopt = (
    role: OrganizationRole = OrganizationRole.OWNER,
    dto: {
      versionId: string;
      belowMinimumConfirmed?: boolean;
      justification?: string;
    } = { versionId: ids.version },
  ) => service.adopt(ids.organization, ids.actor, role, ids.product, dto);

  it.each([
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.OPERATIONS,
  ])('adopts a validated price atomically for %s', async (role) => {
    const result = await adopt(role);
    expect(result).toMatchObject({
      product: {
        id: ids.product,
        salePrice: '10',
        adoptedPricingVersionId: ids.version,
      },
      adoption: { id: ids.adoption, newPrice: '10' },
    });
    expect(transaction.product.update).toHaveBeenCalledBefore(
      transaction.pricingPriceAdoption.create,
    );
    expect(transaction.pricingPriceAdoption.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          previousPrice: expect.objectContaining({}),
          previousVersionId: null,
          newPrice: expect.objectContaining({}),
        }),
      }),
    );
    expect(transaction.auditLog.create).toHaveBeenCalledOnce();
  });

  it.each([OrganizationRole.FINANCE, OrganizationRole.VIEWER])(
    'rejects all adoption for %s before opening a transaction',
    async (role) => {
      await expect(adopt(role)).rejects.toMatchObject({
        status: 403,
        response: { code: PricingErrorCode.PRICING_FORBIDDEN },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('returns indistinguishable not-found errors for absent products and versions', async () => {
    transaction.$queryRaw.mockResolvedValueOnce([]);
    await expect(adopt()).rejects.toMatchObject({
      status: 404,
      response: { code: PricingErrorCode.PRODUCT_NOT_FOUND },
    });
    transaction.$queryRaw.mockResolvedValueOnce([{ id: ids.product }]);
    transaction.pricingCalculationVersion.findFirst.mockResolvedValueOnce(null);
    await expect(adopt()).rejects.toMatchObject({
      status: 404,
      response: { code: PricingErrorCode.PRICING_VERSION_NOT_FOUND },
    });
  });

  it('rejects a non-finalized version', async () => {
    transaction.pricingCalculationVersion.findFirst.mockResolvedValue({
      ...version(),
      state: 'BUILDING',
    });
    await expect(adopt()).rejects.toMatchObject({
      status: 409,
      response: { code: PricingErrorCode.PRICING_VERSION_NOT_FINALIZED },
    });
  });

  it('rejects unknown, divergent and projection-inconsistent frozen versions', async () => {
    transaction.pricingCalculationVersion.findFirst.mockResolvedValueOnce({
      ...version(),
      snapshot: { snapshotSchemaVersion: 2 },
    });
    await expect(adopt()).rejects.toThrow(/snapshot/i);

    const divergent = structuredClone(snapshot()) as unknown as Record<
      string,
      unknown
    >;
    (
      (divergent.result as Record<string, unknown>).analysis as Record<
        string,
        unknown
      >
    ).price = '9.00';
    transaction.pricingCalculationVersion.findFirst.mockResolvedValueOnce({
      ...version(),
      snapshot: divergent,
    });
    await expect(adopt()).rejects.toThrow(/replay/i);

    transaction.pricingCalculationVersion.findFirst.mockResolvedValueOnce({
      ...version(),
      components: [{ ...version().components[0], totalExact: '999' }],
    });
    await expect(adopt()).rejects.toThrow(/differs/);
  });

  it('rejects a price that cannot be persisted exactly before Decimal conversion', async () => {
    const record = version();
    transaction.pricingCalculationVersion.findFirst.mockResolvedValue({
      ...record,
      analyzedPrice: '1000000000000.00',
      snapshot: {
        ...record.snapshot,
        result: {
          ...record.snapshot.result,
          analysis: {
            ...record.snapshot.result.analysis,
            price: '1000000000000.00',
          },
        },
      },
    });
    // Stub only the historical integrity step: this test isolates the boundary
    // checked immediately before constructing the destination Decimal.
    vi.spyOn(
      service as unknown as { assertVersionIntegrity: () => PricingSnapshotV1 },
      'assertVersionIntegrity',
    ).mockReturnValue(record.snapshot);
    await expect(adopt()).rejects.toMatchObject({
      status: 400,
      response: { code: PricingErrorCode.PRICE_OUT_OF_RANGE },
    });
  });

  it.each([OrganizationRole.OWNER, OrganizationRole.ADMIN])(
    'allows below-minimum adoption with explicit confirmation for %s',
    async (role) => {
      const below = version(snapshot('5.50'));
      transaction.pricingCalculationVersion.findFirst.mockResolvedValue(below);
      transaction.pricingPriceAdoption.create.mockResolvedValue(
        adoptionRecord({
          newPrice: new Prisma.Decimal('5.50'),
          classification: PricingClassification.BELOW_MINIMUM,
          belowMinimumConfirmed: true,
          justification: 'Approved exception',
        }),
      );
      await adopt(role, {
        versionId: ids.version,
        belowMinimumConfirmed: true,
        justification: '  Approved exception  ',
      });
      expect(transaction.pricingPriceAdoption.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            justification: 'Approved exception',
            belowMinimumConfirmed: true,
          }),
        }),
      );
      expect(
        transaction.auditLog.create.mock.calls[0]![0].data.metadata,
      ).not.toHaveProperty('justification');
    },
  );

  it('rejects below-minimum adoption for operations', async () => {
    transaction.pricingCalculationVersion.findFirst.mockResolvedValue(
      version(snapshot('5.50')),
    );
    await expect(
      adopt(OrganizationRole.OPERATIONS, {
        versionId: ids.version,
        belowMinimumConfirmed: true,
        justification: 'Exception',
      }),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: PricingErrorCode.BELOW_MINIMUM_FORBIDDEN },
    });
  });

  it.each([
    [{ justification: 'Exception' }, PricingErrorCode.VALIDATION_ERROR],
    [
      { belowMinimumConfirmed: false, justification: 'Exception' },
      PricingErrorCode.VALIDATION_ERROR,
    ],
    [{ belowMinimumConfirmed: true }, PricingErrorCode.JUSTIFICATION_REQUIRED],
    [
      { belowMinimumConfirmed: true, justification: '' },
      PricingErrorCode.JUSTIFICATION_REQUIRED,
    ],
    [
      { belowMinimumConfirmed: true, justification: '   ' },
      PricingErrorCode.JUSTIFICATION_REQUIRED,
    ],
  ])('rejects incomplete below-minimum evidence %#', async (partial, code) => {
    transaction.pricingCalculationVersion.findFirst.mockResolvedValue(
      version(snapshot('5.50')),
    );
    await expect(
      adopt(OrganizationRole.OWNER, { versionId: ids.version, ...partial }),
    ).rejects.toMatchObject({ status: 400, response: { code } });
  });

  it.each([OrganizationRole.OWNER, OrganizationRole.ADMIN])(
    'returns the existing below-minimum adoption for an idempotent retry by %s',
    async (role) => {
      transaction.product.findFirst.mockResolvedValue({
        id: ids.product,
        salePrice: new Prisma.Decimal('5.500'),
        adoptedPricingVersionId: ids.version,
      });
      transaction.pricingCalculationVersion.findFirst.mockResolvedValue(
        version(snapshot('5.50')),
      );
      transaction.pricingPriceAdoption.findFirst.mockResolvedValue(
        adoptionRecord({
          newPrice: new Prisma.Decimal('5.50'),
          classification: PricingClassification.BELOW_MINIMUM,
          belowMinimumConfirmed: true,
          justification: 'Original approval',
        }),
      );

      const result = await adopt(role);

      expect(result.adoption.id).toBe(ids.adoption);
      expect(result.product).toMatchObject({
        salePrice: '5.5',
        adoptedPricingVersionId: ids.version,
      });
      expect(transaction.product.update).not.toHaveBeenCalled();
      expect(transaction.pricingPriceAdoption.create).not.toHaveBeenCalled();
      expect(transaction.auditLog.create).not.toHaveBeenCalled();
    },
  );

  it('keeps operations forbidden on an idempotent below-minimum state', async () => {
    transaction.product.findFirst.mockResolvedValue({
      id: ids.product,
      salePrice: new Prisma.Decimal('5.50'),
      adoptedPricingVersionId: ids.version,
    });
    transaction.pricingCalculationVersion.findFirst.mockResolvedValue(
      version(snapshot('5.50')),
    );

    await expect(adopt(OrganizationRole.OPERATIONS)).rejects.toMatchObject({
      status: 403,
      response: { code: PricingErrorCode.BELOW_MINIMUM_FORBIDDEN },
    });
    expect(transaction.pricingPriceAdoption.findFirst).not.toHaveBeenCalled();
    expect(transaction.product.update).not.toHaveBeenCalled();
    expect(transaction.pricingPriceAdoption.create).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it('treats numerically equivalent current prices as an idempotent success', async () => {
    transaction.product.findFirst.mockResolvedValue({
      id: ids.product,
      salePrice: new Prisma.Decimal('10.0'),
      adoptedPricingVersionId: ids.version,
    });
    transaction.pricingPriceAdoption.findFirst.mockResolvedValue(
      adoptionRecord(),
    );
    const result = await adopt();
    expect(result.product.salePrice).toBe('10');
    expect(transaction.product.update).not.toHaveBeenCalled();
    expect(transaction.pricingPriceAdoption.create).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it('creates a new event when the same version follows an intermediate state', async () => {
    transaction.product.findFirst.mockResolvedValue({
      id: ids.product,
      salePrice: new Prisma.Decimal('12.00'),
      adoptedPricingVersionId: '00000000-0000-4000-8000-000000000009',
    });
    await adopt();
    expect(transaction.pricingPriceAdoption.create).toHaveBeenCalledOnce();
  });

  it('rolls back the complete operation when audit creation fails', async () => {
    const failure = new Error('audit failure');
    transaction.auditLog.create.mockRejectedValue(failure);
    await expect(adopt()).rejects.toBe(failure);
  });

  it('translates only P2034 and propagates P2028, P2002 and generic failures', async () => {
    prisma.$transaction.mockRejectedValueOnce({ code: 'P2034' });
    await expect(adopt()).rejects.toMatchObject({
      status: 409,
      response: { code: PricingErrorCode.PRICING_CONCURRENT_MODIFICATION },
    });
    for (const failure of [
      { code: 'P2028' },
      { code: 'P2002' },
      new Error('unexpected'),
    ]) {
      prisma.$transaction.mockRejectedValueOnce(failure);
      await expect(adopt()).rejects.toBe(failure);
    }
  });
});
