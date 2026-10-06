import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PricingParameterOrigin } from '../../generated/prisma/enums.js';
import { PricingErrorCode } from '../errors/pricing-http.exception.js';
import { PricingProfilesService } from './pricing-profiles.service.js';

describe('PricingProfilesService', () => {
  const organizationId = '781282d6-3151-459d-8a4b-390174ea7646';
  const actorUserId = '85dac119-ee81-44cd-bc0b-7481e26b685b';
  const profileId = '2fe57935-96bb-42f3-92b2-d31f5c0dbdd9';
  const revisionId = '596bfa57-f545-4e3e-8558-7c87f8772464';
  const now = new Date('2026-10-06T12:00:00.000Z');
  const details = {
    schemaVersion: 1,
    source: null,
    referenceId: null,
    periodStart: null,
    periodEnd: null,
    criterion: null,
    measuredAt: null,
    confirmedByUserId: actorUserId,
  };
  const deduction = {
    id: '7236e83e-5da7-485f-b516-926d9e1891ad',
    position: 1,
    name: 'Cartão',
    category: 'CARD',
    rate: new Prisma.Decimal('0.025'),
    origin: PricingParameterOrigin.MANUAL,
    originDetails: details,
    createdAt: now,
  };
  const profile = {
    id: profileId,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    currentRevision: {
      id: revisionId,
      revision: 1,
      name: 'Varejo',
      effectiveFrom: now,
      createdAt: now,
      deductions: [deduction],
    },
  };
  const transaction = {
    $queryRaw: vi.fn(),
    pricingSalesProfile: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    pricingSalesProfileRevision: { create: vi.fn() },
    pricingDeduction: { createMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(),
    pricingSalesProfile: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };
  let service: PricingProfilesService;

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(async (value: unknown) =>
      typeof value === 'function'
        ? value(transaction)
        : Promise.all(value as Promise<unknown>[]),
    );
    transaction.$queryRaw.mockResolvedValue([{ id: profileId }]);
    transaction.pricingSalesProfile.findFirst.mockResolvedValue(profile);
    transaction.pricingSalesProfile.create.mockResolvedValue({ id: profileId });
    transaction.pricingSalesProfileRevision.create.mockResolvedValue({
      id: revisionId,
    });
    transaction.pricingDeduction.createMany.mockResolvedValue({ count: 0 });
    transaction.pricingSalesProfile.update.mockResolvedValue(profile);
    transaction.auditLog.create.mockResolvedValue({});
    service = new PricingProfilesService(prisma as unknown as PrismaService);
  });

  it('creates the root, first revision, ordered deductions and audit atomically', async () => {
    await service.create(organizationId, actorUserId, {
      name: 'Varejo',
      deductions: [
        {
          name: 'Cartão',
          category: 'CARD',
          rate: '0.02500000',
          origin: PricingParameterOrigin.MANUAL,
        },
        {
          name: 'Imposto',
          category: 'TAX',
          rate: '0.1',
          origin: PricingParameterOrigin.FINANCIAL_AGGREGATE,
        },
      ],
    });
    const data = transaction.pricingDeduction.createMany.mock.calls[0]![0].data;
    expect(data).toMatchObject([
      {
        position: 1,
        rate: '0.025',
        originDetails: { confirmedByUserId: actorUserId },
      },
      {
        position: 2,
        rate: '0.1',
        originDetails: { confirmedByUserId: actorUserId },
      },
    ]);
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'pricing_sales_profile.created',
      }),
    });
  });

  it('accepts an empty deduction collection', async () => {
    await service.create(organizationId, actorUserId, {
      name: 'Sem taxas',
      deductions: [],
    });
    expect(transaction.pricingDeduction.createMany).not.toHaveBeenCalled();
  });

  it('updates with complete ordered replacement and canonical rates', async () => {
    transaction.pricingSalesProfile.update.mockResolvedValue({
      ...profile,
      currentRevision: { ...profile.currentRevision, revision: 2 },
    });
    await service.update(organizationId, actorUserId, profileId, {
      expectedRevision: 1,
      deductions: [
        {
          name: 'Nova',
          category: 'CUSTOM',
          rate: '0.05000000',
          origin: PricingParameterOrigin.COPIED,
        },
      ],
    });
    const data =
      transaction.pricingSalesProfileRevision.create.mock.calls[0]![0].data;
    expect(data.name).toBe('Varejo');
    expect(
      transaction.pricingDeduction.createMany.mock.calls[0]![0].data,
    ).toMatchObject([{ position: 1, rate: '0.05' }]);
    expect(
      transaction.auditLog.create.mock.calls[0]![0].data.metadata.changedFields,
    ).toEqual(['deductions']);
  });

  it('preserves deductions when only the name is sent', async () => {
    transaction.pricingSalesProfile.update.mockResolvedValue({
      ...profile,
      currentRevision: {
        ...profile.currentRevision,
        revision: 2,
        name: 'Atacado',
      },
    });
    await service.update(organizationId, actorUserId, profileId, {
      expectedRevision: 1,
      name: 'Atacado',
    });
    const created =
      transaction.pricingDeduction.createMany.mock.calls[0]![0].data;
    expect(created[0]).toMatchObject({
      name: 'Cartão',
      rate: '0.025',
      originDetails: details,
    });
  });

  it('returns a semantic no-op without revision or audit', async () => {
    const result = await service.update(
      organizationId,
      actorUserId,
      profileId,
      {
        expectedRevision: 1,
        name: 'Varejo',
        deductions: [
          {
            name: 'Cartão',
            category: 'CARD',
            rate: '0.02500000',
            origin: PricingParameterOrigin.MANUAL,
          },
        ],
      },
    );
    expect(result.currentRevision.revision).toBe(1);
    expect(
      transaction.pricingSalesProfileRevision.create,
    ).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects a stale revision before writing', async () => {
    await expect(
      service.update(organizationId, actorUserId, profileId, {
        expectedRevision: 4,
        name: 'Novo',
      }),
    ).rejects.toMatchObject({
      response: { code: PricingErrorCode.PRICING_REVISION_CONFLICT },
    });
    expect(
      transaction.pricingSalesProfileRevision.create,
    ).not.toHaveBeenCalled();
  });

  it('returns the same not-found error for an unavailable profile', async () => {
    transaction.$queryRaw.mockResolvedValue([]);
    await expect(
      service.update(organizationId, actorUserId, profileId, {
        expectedRevision: 1,
      }),
    ).rejects.toMatchObject({
      response: { code: PricingErrorCode.PRICING_PROFILE_NOT_FOUND },
    });
  });

  it('rejects updates to an inactive profile', async () => {
    transaction.pricingSalesProfile.findFirst.mockResolvedValue({
      ...profile,
      isActive: false,
    });
    await expect(
      service.update(organizationId, actorUserId, profileId, {
        expectedRevision: 1,
        name: 'Novo',
      }),
    ).rejects.toMatchObject({
      response: { code: PricingErrorCode.PRICING_PROFILE_INACTIVE },
    });
  });

  it('deactivates once and audits without changing history', async () => {
    transaction.pricingSalesProfile.update.mockResolvedValue({
      ...profile,
      isActive: false,
    });
    const result = await service.deactivate(
      organizationId,
      actorUserId,
      profileId,
      { expectedRevision: 1 },
    );
    expect(result.isActive).toBe(false);
    expect(
      transaction.pricingSalesProfileRevision.create,
    ).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'pricing_sales_profile.deactivated',
      }),
    });
  });

  it('treats repeated deactivation as no-op after revision validation', async () => {
    transaction.pricingSalesProfile.findFirst.mockResolvedValue({
      ...profile,
      isActive: false,
    });
    await service.deactivate(organizationId, actorUserId, profileId, {
      expectedRevision: 1,
    });
    expect(transaction.pricingSalesProfile.update).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it('propagates audit failure so the transaction can roll back', async () => {
    transaction.auditLog.create.mockRejectedValue(new Error('audit failed'));
    await expect(
      service.create(organizationId, actorUserId, { name: 'Varejo' }),
    ).rejects.toThrow('audit failed');
  });

  it.each(['P2002', 'P2034'])('translates Prisma conflict %s', async (code) => {
    prisma.$transaction.mockRejectedValue({ code });
    await expect(
      service.create(organizationId, actorUserId, { name: 'Varejo' }),
    ).rejects.toMatchObject({
      response: { code: PricingErrorCode.PRICING_CONCURRENT_MODIFICATION },
    });
  });
});
